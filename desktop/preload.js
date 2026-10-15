'use strict';
// Pont minimal et sûr entre les pages et l'application (aucun accès direct à Node).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('parlotteDesktop', {
  isDesktop: true,
  platform: process.platform,
  // écran d'accueil
  state: () => ipcRenderer.invoke('launcher:state'),
  host: () => ipcRenderer.send('launcher:host'),
  join: url => ipcRenderer.send('launcher:join', String(url || '')),
  importData: () => ipcRenderer.invoke('launcher:import'),
  // depuis Parlotte
  openLauncher: () => ipcRenderer.send('app:launcher'),
  showAddresses: () => ipcRenderer.send('app:addresses'),
  info: () => ipcRenderer.invoke('app:info'),
  backups: () => ipcRenderer.invoke('app:backups'),
  backupNow: () => ipcRenderer.invoke('app:backupNow'),
  restore: file => ipcRenderer.send('app:restore', String(file || '')),
  setBadge: n => ipcRenderer.send('app:badge', Number(n) || 0),
  attention: () => ipcRenderer.send('app:attention'),
  idleSeconds: () => ipcRenderer.invoke('app:idle'),
  onGame: cb => ipcRenderer.on('app:game', (e, name) => cb(String(name || ''))),
  setShowGame: on => ipcRenderer.send('app:showGame', !!on),
  onUpdate: cb => ipcRenderer.on('app:update', (e, u) => cb({ version: String(u?.version || '') })),
  installUpdate: () => ipcRenderer.send('app:installUpdate'),
  // accès de partout (Tailscale)
  publicStatus: () => ipcRenderer.invoke('app:public'),
  publicStart: () => ipcRenderer.invoke('app:publicStart'),
  publicStop: () => ipcRenderer.invoke('app:publicStop'),
  openSafe: url => ipcRenderer.send('app:openSafe', String(url || '')),
  // sélecteur de partage d'écran
  onSources: cb => ipcRenderer.on('picker:sources', (e, list) => cb(list)),
  choose: id => ipcRenderer.send('picker:choose', id),
});
