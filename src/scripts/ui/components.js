const iconPaths={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 16l4-5 4 2 5-7"/>',
  bar:'<path d="M5 20v-7M10 20V8M15 20v-11M20 20V4"/>',
  wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a3 3 0 0 1-3-3"/><path d="M22 13h-6a2 2 0 1 0 0 4h6"/>',
  coins:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  arrowUp:'<path d="m6 14 6-6 6 6M12 8v12"/>',
  arrowDown:'<path d="m6 10 6 6 6-6M12 16V4"/>',
  'arrow-down-left':'<path d="M17 7 7 17M7 7v10h10"/>',
  house:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  piggy:'<path d="M19 9c1.2 1 2 2.5 2 4.2 0 3.7-3 6.8-7 6.8H8c-3.5 0-6-2.7-6-6 0-2.5 1.6-4.4 4-5.5A8 8 0 0 1 17 6l3-1-.5 4"/><path d="M9 8h4M8 20v2M17 20v2"/><circle cx="16" cy="12" r=".7" fill="currentColor" stroke="none"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  left:'<path d="m15 18-6-6 6-6"/>',
  edit:'<path d="m15 5 4 4M4 20l4-.8L20 7a2.8 2.8 0 0 0-4-4L4 15z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert:'<path d="M12 3 2 21h20L12 3zM12 9v5M12 17h.01"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  menu:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  credit:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  motorcycle:'<circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 18 9 9l4 9 3-7h3M9 9h4M15 7h4"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
export const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.grid}</svg>`;
export const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export const titleRow=(heading,subtitle,action='')=>`<div class="section-heading"><div><h1>${heading}</h1><p>${subtitle}</p></div>${action}</div>`;
export const btn=(action,label,kind='secondary',other='')=>`<wa-button type="button" appearance="filled" variant="${kind==='primary'?'brand':kind==='danger'?'danger':'neutral'}" class="btn ${kind}" data-action="${action}" ${other}>${label}</wa-button>`;
export const webIcon=(name,label='')=>`<wa-icon name="${name}" ${label?`label="${esc(label)}"`:'aria-hidden="true"'}></wa-icon>`;
export const actionIcon=(action,iconName,aria,attrs='')=>`<wa-tooltip for="action-${action}-${esc(attrs.match(/data-id="([^"]+)"/)?.[1]||'global')}">${esc(aria)}</wa-tooltip><wa-button id="action-${action}-${esc(attrs.match(/data-id="([^"]+)"/)?.[1]||'global')}" type="button" size="xs" appearance="outlined" variant="neutral" class="mini-icon" data-action="${action}" aria-label="${esc(aria)}" title="${esc(aria)}" ${attrs}>${webIcon(({plus:'plus',left:'chevron-left',chevron:'chevron-right',edit:'pen',trash:'trash',close:'xmark'})[iconName]||iconName,aria)}</wa-button>`;
export const empty=(title,text,actionHtml='')=>`<div class="empty-state">${icon('info',24)}<strong>${title}</strong><p>${text}</p>${actionHtml}</div>`;
export const formatDate=date=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`));
export const optionHtml=(value,label,selected)=>`<wa-option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</wa-option>`;
