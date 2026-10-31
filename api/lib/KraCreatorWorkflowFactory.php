<?php
declare(strict_types=1);

/** Starter YouTube flow definition for the KRA approval-gated workflow engine. */
final class KraCreatorWorkflowFactory
{
    public static function starterNodes(string $workflowTitle): array
    {
        $slug = strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $workflowTitle), '-'));
        $slug = substr($slug !== '' ? $slug : 'creator-flow', 0, 48);
        $path = 'docs/content-creator/' . $slug . '/';

        return [
            [
                'id' => 'research', 'agentId' => 'creator_research', 'title' => 'Nara · source-verified topic research',
                'targetFile' => $path . '01-research.md',
                'summary' => 'Research task scaffold. Replace the placeholder with verified sources and a duplicate check before approval.',
                'proposedContent' => "# Topic research\n\nWorkflow: {$workflowTitle}\n\n## Research brief\n- Topic: [ADD TOPIC]\n- Audience: [ADD AUDIENCE]\n- Source links: [ADD AND VERIFY SOURCES]\n- Duplicate check: [RECORD SEARCH TERMS AND SIMILAR PUBLISHED VIDEOS]\n- Recommendation: [PROCEED / REVISE]\n\nThis is a human-editable scaffold; no research was performed automatically.\n",
            ],
            [
                'id' => 'script', 'agentId' => 'creator_writer', 'title' => 'Aruna · script & metadata draft',
                'targetFile' => $path . '02-script-metadata.md', 'dependsOn' => ['research'],
                'summary' => 'Draft task scaffold. No AI-generated script is claimed; fill in the approved topic and content.',
                'proposedContent' => "# Script & metadata draft\n\nWorkflow: {$workflowTitle}\nFormat: [SHORTS / LONG-FORM]\n\n## Hook\n[WRITE HOOK]\n\n## Script\n[WRITE SCRIPT]\n\n## Description\n[WRITE DESCRIPTION]\n\n## Title options\n1. [TITLE]\n2. [TITLE]\n\n## Sources / credits\n[ADD SOURCES]\n",
            ],
            [
                'id' => 'editorial-review', 'agentId' => 'creator_reviewer', 'title' => 'Lintang · editorial accuracy & rights review',
                'targetFile' => $path . '03-editorial-review.md', 'dependsOn' => ['script'],
                'summary' => 'Editorial approval record. Human must review research, script, rights, and factual claims.',
                'proposedContent' => "# Editorial approval\n\n- Decision: [APPROVE / REVISE]\n- Reviewer: [NAME]\n- Approved topic and script version: [REFERENCE]\n- Factual claims checked: [YES / NOTES]\n- Rights / source check: [YES / NOTES]\n- Decision timestamp: [RECORD]\n",
            ],
            [
                'id' => 'production', 'agentId' => 'creator_producer', 'title' => 'Dito · production handoff',
                'targetFile' => $path . '04-production-handoff.md', 'dependsOn' => ['editorial-review'],
                'summary' => 'Production checklist scaffold. Video rendering and assets are not connected to this workflow.',
                'proposedContent' => "# Production handoff\n\n- Editorial approval reference: [LINK]\n- Video file / project: [ADD PATH OR LINK]\n- Captions: [ADD / REVIEW]\n- Thumbnail: [ADD / REVIEW]\n- Audio and visual rights: [VERIFY]\n- QA notes: [ADD]\n\nNo video was rendered by this task.\n",
            ],
            [
                'id' => 'final-approval', 'agentId' => 'creator_reviewer', 'title' => 'Lintang · final content readiness check',
                'targetFile' => $path . '05-final-approval.md', 'dependsOn' => ['production'],
                'summary' => 'Final approval record. Choose visibility only after reviewing content and metadata. Upload stays blocked until OAuth is configured.',
                'proposedContent' => "# Final upload approval\n\n- Final video reviewed: [YES / NO]\n- Title / description / thumbnail reviewed: [YES / NOTES]\n- Channel: [UNCONFIGURED]\n- Visibility: [PRIVATE / UNLISTED / PUBLIC]\n- Human approver: [NAME]\n- Decision: [APPROVE / REJECT]\n- Decision timestamp: [RECORD]\n\nThis is an approval record only; no YouTube upload is implemented.\n",
            ],
        ];
    }
}
