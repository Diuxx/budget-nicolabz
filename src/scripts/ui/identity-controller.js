import { confirmAction } from './alerts.js';
import { renderIdentityProfile, parseIdentitySession } from './identity-profile.js';
import { synchronizeIdentity, getIdentitySyncInfo } from '../services/identity-sync.js';
import { saveData } from '../core/storage.js';

export function createIdentityController({model,connection,identityApi,syncChoiceDialog,render,showToast}){
  let identityError=null;
  let identityChecking=true;
  let sessionRefreshPromise=null;
  let driveReconnectUserId=null;
  let tracking=false;
  let syncScheduled=false;
  let pendingSync=false;
  let syncFailed=false;
  let syncCancelled=false;
  function updateDriveStatus() {
    const {authenticated,driveConnected}=connection.sessionState;
    const driveReconnectRequired=authenticated&&driveReconnectUserId===connection.sessionState.user?.id;
    document.querySelectorAll('.drive-panel details').forEach(details=>{details.hidden=!(authenticated&&driveConnected);});
    const visible={
      'auth-login':!authenticated,
      'auth-drive':authenticated,
      'drive-sync':authenticated&&driveConnected&&(syncFailed||Boolean(identityError)),
      'drive-pull':authenticated&&driveConnected,
      'drive-push':authenticated&&driveConnected,
      'auth-logout':authenticated,
    };
    document.querySelectorAll('.drive-panel [data-action]').forEach(button=>{
      button.hidden=!visible[button.dataset.action];
      button.disabled=identityChecking||connection.busy||(Boolean(identityError)&&button.dataset.action!=='drive-sync');
      if(button.dataset.action==='auth-drive')button.textContent=driveConnected||driveReconnectRequired?'Réautoriser Google Drive':'Autoriser Google Drive';
      if(button.dataset.action==='drive-sync')button.textContent='Réessayer la synchronisation';
    });
    const indicator=document.querySelector('#driveStatus');
    if (indicator) {
      indicator.classList.toggle('connected',driveConnected&&!syncFailed&&!identityError);
      indicator.textContent=identityError ? `Service indisponible : ${identityError}`
        : !connection.sessionState.authenticated ? 'Compte Google non connecté'
        : driveReconnectRequired ? 'Compte connecté · réautorisation Drive requise'
        : !connection.sessionState.driveConnected ? 'Compte connecté · autorisation Drive requise'
        : syncFailed ? 'Synchronisation à reprendre dans les paramètres'
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
      syncing:connection.busy,
      driveReconnectRequired:connection.sessionState.authenticated&&driveReconnectUserId===connection.sessionState.user?.id,
      syncFailed,
    });
  }

  function refreshSession() {
    // Une seule requête simultanée, même si l'onglet reprend le focus au retour OAuth.
    if (sessionRefreshPromise) return sessionRefreshPromise;
    identityChecking=true;
    updateDriveStatus();
    sessionRefreshPromise=(async()=>{
      try {
        const previous=connection.sessionState;
        const session=parseIdentitySession(await identityApi.getSession());
        if(session.authenticated&&previous.authenticated&&session.user.id===previous.user?.id&&previous.driveConnected&&!session.driveConnected) {
          driveReconnectUserId=session.user.id;
          showToast('Accès Drive perdu. Réautorisez Google Drive dans Paramètres.',true);
        }
        if(session.authenticated&&session.user.id===driveReconnectUserId)session.driveConnected=false;
        else driveReconnectUserId=null;
        connection.sessionState=session;
        identityError=null;
        if(tracking&&session.authenticated&&session.driveConnected&&
          (!previous.authenticated||!previous.driveConnected||previous.user?.id!==session.user.id||syncFailed&&!syncCancelled&&!connection.busy))scheduleAutomaticSync();
      } catch(error) {
        // Une indisponibilité de l’API ne prouve pas que Google a déconnecté l'utilisateur.
        identityError=error.message;
        console.error('[Pécule] Échec de vérification de session Nicolabz Identity :', error);
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
    if(connection.busy) {showToast('Attendez la fin de la synchronisation.',true);return;}
    try {
      await identityApi.logout();
      connection.sessionState={authenticated:false,user:null,driveConnected:false};
      driveReconnectUserId=null;
      identityError=null;
      syncFailed=false;
      syncCancelled=false;
      connection.locallyModified=false;
      updateDriveStatus();
      showToast('Compte déconnecté. Le budget local est conservé.');
    } catch(error) {showToast(`Déconnexion : ${error.message}`,true);}
  }
  async function disconnectDrive() {
    if(connection.busy) {showToast('Attendez la fin de la synchronisation.',true);return;}
    if (!await confirmAction('Dissocier l’autorisation Drive ? Les fichiers Drive ne seront pas supprimés.')) return;
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
  function scheduleAutomaticSync() {
    pendingSync=true;
    if(syncScheduled||connection.busy)return;
    syncScheduled=true;
    setTimeout(()=>{
      syncScheduled=false;
      if(connection.busy)return;
      if(!pendingSync)return;
      pendingSync=false;
      if(model.loadError||identityError||!connection.sessionState.authenticated||!connection.sessionState.driveConnected)return;
      void driveAction('auto',true);
    },0);
  }
  async function driveAction(mode,automatic=false) {
    if (connection.busy) return;
    if (model.loadError) {if(!automatic)showToast('Importez une sauvegarde valide avant de synchroniser.',true);return;}
    if (!connection.sessionState.authenticated) {startLogin();return;}
    if (!connection.sessionState.driveConnected) {startDriveConsent();return;}
    pendingSync=false;
    syncFailed=false;
    syncCancelled=false;
    connection.busy=true;
    updateDriveStatus();
    const userId=connection.sessionState.user.id;
    let expectedLocal;
    let expectedModel;
    const assertCurrent=()=>{
      if(!connection.sessionState.authenticated||connection.sessionState.user?.id!==userId||!connection.sessionState.driveConnected||
        localStorage.getItem('pecule:budget:v1')!==expectedLocal||JSON.stringify(model.data)!==expectedModel) {
        throw new Error('La session ou le budget local a changé. Rechargez la page avant de synchroniser.');
      }
    };
    try {
      expectedLocal=localStorage.getItem('pecule:budget:v1');
      expectedModel=JSON.stringify(model.data);
      const currentSession=parseIdentitySession(await identityApi.getSession());
      if(currentSession.authenticated&&currentSession.user.id===userId&&!currentSession.driveConnected) {
        connection.sessionState=currentSession;
        throw Object.assign(new Error('Autorisation Google Drive indisponible.'),{code:'DRIVE_NOT_CONNECTED'});
      }
      if(!currentSession.authenticated||currentSession.user.id!==userId) {
        connection.sessionState=currentSession;
        throw new Error('La session Google a changé. Vérifiez le compte avant de synchroniser.');
      }
      identityError=null;
      assertCurrent();
      if(expectedLocal!==null&&JSON.stringify(JSON.parse(expectedLocal))!==expectedModel) {
        throw new Error('Le budget a changé dans un autre onglet. Rechargez la page avant de synchroniser.');
      }
      const result=await synchronizeIdentity({
        api:identityApi,
        userId,
        mode,
        storage:localStorage,
        getData:()=>model.data,
        localDataMissing:expectedLocal===null,
        assertCurrent,
        setData:incoming=>{saveData(incoming);model.data=incoming;expectedLocal=localStorage.getItem('pecule:budget:v1');expectedModel=JSON.stringify(model.data);render();},
        choose:requestSyncChoice,
      });
      const messages={
        created:'Première sauvegarde créée dans Google Drive.',
        uploaded:'Budget enregistré dans Google Drive.',
        downloaded:'Budget Google Drive restauré localement.',
        identical:'Votre budget local et Drive sont identiques.',
        cancel:'Synchronisation annulée : aucune donnée remplacée.',
      };
      connection.locallyModified=result==='cancel';
      syncFailed=result==='cancel';
      syncCancelled=result==='cancel';
      if(!automatic||result!=='identical')showToast(messages[result]||'Synchronisation terminée.');
      updateDriveStatus();
    } catch(error) {
      syncFailed=true;
      connection.locallyModified=true;
      if(error.code==='SYNC_CONFLICT')showToast('Conflit : Drive a changé pendant l’enregistrement. Relancez la synchronisation pour choisir la version.',true);
      else if(error.code==='DRIVE_RECONNECT_REQUIRED'||error.code==='DRIVE_NOT_CONNECTED'||error.code==='DRIVE_ACCESS_DENIED') {
        if(connection.sessionState.user?.id===userId) {
          driveReconnectUserId=userId;
          connection.sessionState={...connection.sessionState,driveConnected:false};
          await refreshSession();
        }
        showToast('Accès Drive refusé ou expiré. Réautorisez Google Drive dans Paramètres.',true);
      } else showToast(`Google Drive : ${error.message}`,true);
    } finally {connection.busy=false;updateDriveStatus();if(pendingSync)scheduleAutomaticSync();}
  }



  function startSessionTracking(){
    tracking=true;
    const authResult=consumeAuthResult();void refreshSession().then(session=>{if(authResult==='connected'&&!session.authenticated&&!identityError)showToast('Connexion Google à vérifier.',true);});
    window.addEventListener('pageshow',event=>{if(event.persisted)void refreshSession();});window.addEventListener('focus',()=>{void refreshSession();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshSession();});
    document.querySelector('#profileMenu')?.addEventListener('wa-show',()=>{void refreshSession();});
  }
  return {updateDriveStatus,refreshSession,startLogin,startDriveConsent,logout,disconnectDrive,driveAction,startSessionTracking,scheduleAutomaticSync};
}
