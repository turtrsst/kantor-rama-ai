'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'web/app.js'), 'utf8');
const start = app.indexOf('function renderCreatorTeam() {');
const end = app.indexOf('\nfunction creatorStudioChannelFor(', start);
assert(start >= 0 && end > start, 'Creator roster renderer exists');

class Element {
  constructor(tag = 'div', className = '') {
    this.tagName = tag.toUpperCase();
    this.className = className;
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.listeners = {};
    this.textContent = '';
    this._innerHTML = '';
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.nodes = new Map();
    const pattern = /<([a-z0-9]+)[^>]*class="([^"]+)"[^>]*>/gi;
    let match;
    while ((match = pattern.exec(this._innerHTML))) {
      for (const name of match[2].split(/\s+/)) {
        if (!this.nodes.has('.' + name)) this.nodes.set('.' + name, new Element(match[1], name));
      }
    }
    if (this._innerHTML.includes('class="creator-agent-progress"')) {
      this.nodes.set('.creator-agent-progress span', new Element('span'));
    }
  }
  get innerHTML() { return this._innerHTML; }
  replaceChildren(...children) { this.children = [...children]; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes ||= {}; this.attributes[name] = String(value); }
  querySelector(selector) { return this.nodes?.get(selector) || null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
}

const grid = new Element('div');
const count = new Element('span');
let officeModeActivated = 0;
const document = {
  getElementById(id) { return id === 'creator-team-grid' ? grid : id === 'creator-team-count' ? count : null; },
  createElement(tag) { return new Element(tag); },
  createTextNode(text) { return { textContent: String(text) }; },
  querySelector() { return { click() { officeModeActivated += 1; } }; }
};
const agents = [
  { id: 'creator_research', name: 'Nara', role: 'Content Research Analyst', palette: { accent: '#4f9b7b' } },
  { id: 'creator_writer', name: 'Aruna', role: 'Scriptwriter & Metadata Editor', palette: { accent: '#bc795f' } },
  { id: 'creator_producer', name: 'Dito', role: 'Creative Production Planner', palette: { accent: '#6489b6' } },
  { id: 'creator_reviewer', name: 'Lintang', role: 'Quality & Publishing Reviewer', palette: { accent: '#e3b66c' } }
];
let synchronizedAgents = [];
let selectedChannel = '';
const context = {
  document,
  window: { KRACreatorSceneRenderer: { setAgents(value) { synchronizedAgents = value; } } },
  creatorAgents: agents,
  creatorStageForAgent: () => ({ key: 'research', title: 'Research', detail: 'Stage detail' }),
  agentAvatarMarkup: agent => `<svg data-avatar="${agent.id}"></svg>`,
  updateCreatorAmbientLabels() {},
  renderCreatorStudioTerminal() {},
  registerHiredChatChannel() {},
  openCreatorStudioTerminal(id) { selectedChannel = id; },
  String,
  Map
};
vm.runInNewContext(app.slice(start, end) + '\nrenderCreatorTeam();', context);

assert.equal(count.textContent, '4 studio agents', 'built-in roster count is visible');
assert.equal(grid.children.length, 4, 'one visible card is rendered for each built-in specialist');
assert.deepEqual(grid.children.map(card => card.dataset.agentId), agents.map(agent => agent.id), 'all four specialists have a card');
for (const card of grid.children) {
  assert(card.innerHTML.includes('<svg'), `${card.dataset.agentId} card includes its avatar markup`);
  assert(card.querySelector('.creator-agent-progress span'), `${card.dataset.agentId} progress bar exists before its width is set`);
  assert(card.querySelector('.creator-agent-name')?.textContent, `${card.dataset.agentId} card has a visible name`);
}
assert.equal(synchronizedAgents.length, 4, 'all four visible specialists are synchronized into the 3D scene');
assert.equal(typeof grid.listeners.click, 'function', 'Creator card chat buttons have a delegated click handler');
for (const agent of agents) {
  grid.listeners.click({ target: { closest: () => ({ dataset: { openCreatorChat: agent.id } }) } });
  assert.equal(selectedChannel, agent.id, `${agent.name} CHAT opens that specialist's private channel`);
}
assert.equal(officeModeActivated, 0, 'Creator CHAT buttons never leave Creator Studio for Virtual Office');
assert(app.slice(start, end).includes('openCreatorStudioTerminal(agentId)'), 'card CHAT actions open the dedicated Studio terminal');
assert(!app.slice(start, end).includes('switchChatChannel(agentId)') && !app.slice(start, end).includes('data-app-mode=\"office\"'), 'card CHAT actions do not switch to Virtual Office');
assert(app.slice(start, end).includes('renderCreatorStudioTerminal();'), 'the Creator roster renders its dedicated terminal alongside the cards');
assert(app.includes("return 'creator_studio_' + (suffix || 'agent')"), 'Studio chat channels are distinct from Virtual Office channels');
assert(app.includes("action=chat-history&channel=' + encodeURIComponent(channel)"), 'Studio terminal loads its own persisted channel history');
assert(app.includes("channel: creatorStudioChannelFor(agentId), ...(isGroup ? {} : { agentId })"), 'Studio terminal sends direct chats to the selected Creator persona and group prompts to the crew channel');
assert(app.includes('CREATOR_STUDIO_GROUP_ID = \'creator_studio_team\'') && app.includes('groupButton.dataset.creatorTerminalAgent = CREATOR_STUDIO_GROUP_ID'), 'Studio Crew is a selectable all-agent group tab');
assert(app.includes('reply.sender || reply.agentId'), 'group replies display the correct specialist identity');
assert(app.includes('creatorStudioProviderSelect?.addEventListener(\'change\''), 'Studio terminal has an independent provider selector');
const terminalStart = app.indexOf('function renderCreatorStudioTerminal(options = {}) {');
const terminalEnd = app.indexOf('\nfunction openCreatorStudioTerminal(', terminalStart);
const terminalTabs = new Element('div');
let selectedTerminal = '';
const terminalContext = {
  document: { getElementById: () => terminalTabs, createElement: tag => new Element(tag) },
  creatorAgents: agents,
  DEFAULT_CREATOR_AGENTS: agents,
  CREATOR_STUDIO_GROUP_ID: 'creator_studio_team',
  activeCreatorStudioAgentId: 'creator_studio_team',
  agentAvatarMarkup: agent => `<svg data-avatar="${agent.id}"></svg>`,
  selectCreatorStudioAgent(id) { selectedTerminal = id; },
  renderCreatorStudioEmpty() {},
  String
};
vm.runInNewContext(app.slice(terminalStart, terminalEnd) + '\nrenderCreatorStudioTerminal();', terminalContext);
assert.equal(terminalTabs.children.length, 5, 'group tab plus four individual specialist tabs are rendered');
assert.equal(terminalTabs.children[0].dataset.creatorTerminalAgent, 'creator_studio_team', 'Studio Crew group is the default terminal destination');
assert.equal(terminalTabs.children[0].children[1].textContent, 'Studio Crew', 'group tab is clearly labeled');
assert.equal(selectedTerminal, 'creator_studio_team', 'initial Studio terminal selection broadcasts to the group');
console.log('Creator roster verification passed: four specialist cards/avatars, Studio-only CHAT buttons, isolated direct channels, and the shared Studio Crew group tab.');
