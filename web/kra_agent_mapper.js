/**
 * KRA Agent Mapper
 * Maps Munder Difflin archetypes to KRA agent manifest structure.
 */

'use strict';

function resolveRecommendedEngine(capabilities = [], skills = []) {
  const combined = [...capabilities, ...skills].join(' ').toLowerCase();
  if (combined.includes('pptx') || combined.includes('docx') || combined.includes('sales') || combined.includes('proposal') || combined.includes('finance')) {
    return {
      provider: 'claude-code',
      model: 'opus-5-5',
      command: 'claude --model claude-opus-5-5 --permission-mode bypassPermissions'
    };
  }
  if (combined.includes('developer') || combined.includes('engineer') || combined.includes('code') || combined.includes('devops')) {
    return {
      provider: 'opencode',
      model: 'sonnet-4-6',
      command: 'opencode run'
    };
  }
  if (combined.includes('research') || combined.includes('analyst') || combined.includes('audit')) {
    return {
      provider: 'codex-gpt',
      model: 'fable-5-1',
      command: 'codex run'
    };
  }
  return {
    provider: 'claude-code',
    model: 'haiku-4-5',
    command: 'claude --model claude-haiku-4-5'
  };
}

function mapUniformToCharacter(appearance = {}, defaultChar = 'budi') {
  const top = appearance.top || '';
  if (top.includes('suit') || top.includes('executive')) return 'rama';
  if (top.includes('blazer') || top.includes('studio')) return 'maya';
  if (top.includes('lab_coat')) return 'siti';
  if (top.includes('tactical')) return 'dimas';
  return defaultChar || 'budi';
}

function mapMunderArchetypeToKRAForm(archetype, munderInput = {}) {
  const configs = archetype?.configs || {};
  const skillsList = [
    ...(archetype?.skills?.catalog || []),
    ...(archetype?.skills?.custom || [])
  ];

  const engineRec = resolveRecommendedEngine(configs.capabilities || [], skillsList);
  const formattedSkills = skillsList.length > 0
    ? '\n\nEquipped Skills:\n' + skillsList.map(s => `- ${s.replace(/^skill:/, '')}`).join('\n')
    : '';

  return {
    identity: {
      name: munderInput.name || archetype?.name || '',
      character: mapUniformToCharacter(munderInput.appearance, configs.character),
      color: munderInput.accent || configs.accent || '#4ECDC4',
      appearance: {
        spriteVersion: '2.0-ortho-ref',
        body: munderInput.appearance?.body || 'standard_warm',
        face: munderInput.appearance?.face || 'stern_brows',
        hair: munderInput.appearance?.hair || 'exec_part_dark',
        top: munderInput.appearance?.top || 'navy_suit_tie',
        bottom: munderInput.appearance?.bottom || 'formal_navy_loafers',
        shoes: munderInput.appearance?.shoes || 'formal_loafers',
        accessories: munderInput.appearance?.accessories || 'none',
        heldItem: munderInput.appearance?.heldItem || 'none',
        hitbox: { width: 24, height: 32, pivot: 'bottom_center' }
      }
    },
    engine: engineRec,
    briefing: {
      template: archetype?.name || 'Custom Archetype',
      description: archetype?.description || configs.role || '',
      goal: (configs.goal || '') + formattedSkills
    }
  };
}

// Export for browser
window.mapMunderArchetypeToKRAForm = mapMunderArchetypeToKRAForm;
