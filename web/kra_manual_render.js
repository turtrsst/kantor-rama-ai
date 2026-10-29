/* KRA manual renderer: Markdown subset -> HTML. No dependencies.
   Covered: headings, paragraphs, ul/ol, tables, fenced code, hr,
   inline code, bold, links. Everything else renders as plain text. */
(function (root) {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = s => String(s).replace(/[&<>"]/g, c => ESC[c]);

  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text, href) =>
      /^https?:\/\//i.test(href) ? '<a href="' + href + '" rel="noopener noreferrer">' + text + '</a>' : text);

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const isTableRow = l => /^\s*\|/.test(l);

  function render(md) {
    const lines = String(md).split(/\r?\n/);
    const html = [];
    const toc = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*$/.test(line)) continue;

      if (line.trim().startsWith('```')) {
        const body = [];
        for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) body.push(lines[i]);
        html.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        const text = heading[2].trim();
        const id = slug(text) || 'section-' + (toc.length + 1);
        if (level >= 2 && level <= 3) toc.push({ level, text, id });
        html.push('<h' + level + ' id="' + id + '">' + inline(text) + '</h' + level + '>');
        continue;
      }

      if (isTableRow(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = cells(line);
        i += 2;
        const rows = [];
        for (; i < lines.length && isTableRow(lines[i]); i++) rows.push(cells(lines[i]));
        i--;
        html.push('<div class="table-scroll"><table><thead><tr>'
          + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'
          + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('')
          + '</tbody></table></div>');
        continue;
      }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { html.push('<hr>'); continue; }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        for (; i < lines.length && /^\s*[-*]\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i--;
        html.push('<ul>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</ul>');
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        for (; i < lines.length && /^\s*\d+\.\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i--;
        html.push('<ol>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</ol>');
        continue;
      }

      const para = [line.trim()];
      for (i++; i < lines.length && !/^\s*$/.test(lines[i])
        && !/^\s*(#{1,6}\s|[-*]\s|\d+\.\s|\||```|-{3,})/.test(lines[i]); i++) para.push(lines[i].trim());
      i--;
      html.push('<p>' + inline(para.join(' ')) + '</p>');
    }

    return { html: html.join('\n'), toc };
  }

  root.KRAManual = { render, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = { render, esc };
})(typeof window !== 'undefined' ? window : globalThis);
