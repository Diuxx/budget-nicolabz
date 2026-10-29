import { renderIdentityProfile, parseIdentitySession } from './identity-profile.js';
import { synchronizeIdentity, getIdentitySyncInfo } from '../services/identity-sync.js';
import { saveData } from '../core/storage.js';

export function createIdentityController({model,connection,identityApi,syncChoiceDialog,render,showToast}){
  let identityError=null;
  let identityChecking=true;
  let sessionRefreshPromise=null;
  function updateDriveStatus() {
    const indicator=document.querySelector('#driveStatus');
    if (indicator) {
      indicator.classList.toggle('connected',connection.sessionState.driveConnected);
      indicator.textContent=identityError ? `Service indisponible : ${identityError}`
        : !connection.sessionState.authenticated ? 'Compte Google non connecté'
        : !connection.sessionState.driveConnected ? 'Compte connecté · autorisation Drive requise'
        : 'Google Drive connecté · prêt à synchroniser';
      const meta=document.querySelector('#driveMeta');
      const anchor=getIdentitySyncInfo({ storage:localStorage, appId:identityApi.appId, userId:connection.sessionState.user?.id });
      if (meta) meta.textContent=anchor
        ? `Dernière synchronisation confirmée : ${new Date(anchor.updatedAt).toLocaleString('fr-FR')} · version ${anchor.version}`
        : 'Aucune synchronisation confirmée sur cet appareil pour ce compte.';
    }
    updateProfile();
  }

  function updateProfile() {
    renderIdentityProfile(document, {
      session: connection.sessionState,
      checking: identityChecking,
      error: identityError,
      locallyModified:connection.locallyModified,
    });
  }

  function refreshSession() {
    // Une seule requête simultanée, même si l'onglet reprend le focus au retour OAuth.
    if (sessionRefreshPromise) return sessionRefreshPromise;
    identityChecking=true;
    updateDriveStatus();
    sessionRefreshPromise=(async()=>{
      try {
        connection.sessionState=parseIdentitySession(await identityApi.getSession());
        identityError=null;
      } catch(error) {
        // Une indisponibilité de l’API ne prouve pas que Google a déconnecté l'utilisateur.
        identityError=error.message;
        console.error('[Marge] Échec de vérification de session Nicolabz Identity :', error);
      } finally {
        identityChecking=false;
        sessionRefreshPromise=null;
        updateDriveStatus();
      }
      return connection.sessionState;
    })();
    return sessionRefreshPromise;
  }

  /** Le paramètre de callback OAuth n'est pas une preuve d'authentification. */
  function consumeAuthResult() {
    const url=new URL(location.href);
    const result=url.searchParams.get('auth');
    if (result===null) return null;
    url.searchParams.delete('auth');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
    return result;
  }

  function returnUrl() {
    // Le serveur vérifie l'origine et le chemin de retour autorisés.
    const url=new URL(location.href);
    url.searchParams.delete('auth');
    return url.href;
  }
  function startLogin() {location.assign(identityApi.loginUrl(returnUrl()));}
  function startDriveConsent() {
    if (!connection.sessionState.authenticated) {startLogin();return;}
    location.assign(identityApi.driveConsentUrl(returnUrl()));
  }
  async function logout() {
    try {
      await identityApi.logout();
      connection.sessionState={authenticated:false,user:null,driveConnected:false};
      identityError=null;
      connection.locallyModified=false;
      updateDriveStatus();
      showToast('Compte déconnecté. Le budget local est conservé.');
    } catch(error) {showToast(`Déconnexion : ${error.message}`,true);}
  }
  async function disconnectDrive() {
    if (!confirm('Dissocier l’autorisation Drive ? Les fichiers Drive ne seront pas supprimés.')) return;
    try {
      await identityApi.disconnectDrive();
      await refreshSession();
      showToast('Accès Drive dissocié. Le budget local est conservé.');
    } catch(error) {showToast(`Drive : ${error.message}`,true);}
  }

  function requestSyncChoice({type,message}) {
    return new Promise(resolve=>{
      syncChoiceDialog.label=type==='empty'?'Créer une sauvegarde Drive':'Conflit de sauvegardes';
      syncChoiceDialog.querySelector('#syncChoiceText').textContent=message;
      syncChoiceDialog.querySelector('[data-sync-choice="remote"]').hidden=type==='empty';
      syncChoiceDialog.querySelector('[data-sync-choice="local"]').textContent=type==='empty'?'Créer sur Google Drive':'Conserver la version locale (écraser Drive)';
      const controller=new AbortController();
      let finished=false;
      const finish=choice=>{
        if(finished)return;
        finished=true;
        controller.abort();
        syncChoiceDialog.open=false;
        resolve(choice);
      };
      syncChoiceDialog.querySelectorAll('[data-sync-choice]').forEach(button=>{
        button.addEventListener('click',()=>finish(button.dataset.syncChoice),{signal:controller.signal});
      });
      syncChoiceDialog.addEventListener('wa-hide',()=>finish('cancel'),{signal:controller.signal});
      syncChoiceDialog.open=true;
    });
  }
  async function driveAction(mode) {
    if (connection.busy) return;
    if (!connection.sessionState.authenticated) {startLogin();return;}
    if (!connection.sessionState.driveConnected) {startDriveConsent();return;}
    connection.busy=true;
    try {
      const result=await synchronizeIdentity({
        api:identityApi,
        userId:connection.sessionState.user.id,
        mode,
        storage:localStorage,
        getData:()=>model.data,
        setData:incoming=>{saveData(incoming);model.data=incoming;render();},
        choose:requestSyncChoice,
      });
      const messages={
        created:'Première sauvegarde créée dans Google Drive.',
        uploaded:'Budget enregistré dans Google Drive.',
        downloaded:'Budget Google Drive restauré localement.',
        identical:'Votre budget local et Drive sont identiques.',
        cancel:'Synchronisation annulée : aucune donnée remplacée.',
      };
      if (result !== 'cancel') connection.locallyModified=false;
      showToast(messages[result]||'Synchronisation terminée.');
      updateDriveStatus();
    } catch(error) {
      if(error.code==='SYNC_CONFLICT')showToast('Conflit : Drive a changé pendant l’enregistrement. Relancez la synchronisation pour choisir la version.',true);
      else if(error.code==='DRIVE_RECONNECT_REQUIRED'||error.code==='DRIVE_NOT_CONNECTED') {
        await refreshSession();
        showToast('Drive doit être réautorisé depuis le menu du compte.',true);
      } else showToast(`Google Drive : ${error.message}`,true);
    } finally {connection.busy=false;}
  }



  function startSessionTracking(){
    const authResult=consumeAuthResult();void refreshSession().then(session=>{if(authResult==='connected'&&!session.authenticated&&!identityError)showToast('Connexion Google à vérifier.',true);});
    window.addEventListener('pageshow',event=>{if(event.persisted)void refreshSession();});window.addEventListener('focus',()=>{void refreshSession();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshSession();});
    document.querySelector('#profileMenu')?.addEventListener('wa-show',()=>{void refreshSession();});
  }
  return {updateDriveStatus,refreshSession,startLogin,startDriveConsent,logout,disconnectDrive,driveAction,startSessionTracking};
}
