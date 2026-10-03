/* Bibidhpustika: subjects and URLs are rendered safely as text. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = window.BIBIDH_INDEX || {entries:[], generatedAt:null};
  const clean = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
  // Nepali character mappings supplied for optional, space-insensitive search.
  const NepaliNormalizer = {
    vowelMap: {'ी':'ि', 'ू':'ु', 'ृ':'ि', 'ऋ':'रि'},
    sibilantMap: {'श':'स', 'ष':'स'},
    nasalMap: {'ङ':'न', 'ण':'न', 'ञ':'न', 'ं':'न्'},
    vaBaMap: {'व':'ब'},
    numberMap: {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'},
    _isDropped(ch, ignoreSpaces) {
      if (ch === '\u200D' || ch === '\u200C') return true;
      if (ignoreSpaces && /\s/.test(ch)) return true;
      return false;
    },
    _transformChar(ch) {
      let s = ch;
      for (const [f,t] of Object.entries(this.vowelMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.sibilantMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.nasalMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.vaBaMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.numberMap)) if (s === f) s = t;
      return s;
    },
    normalize(text, opts = {}) {
      if (!text) return '';
      return this._normalizeWithMap(text, opts).text;
    },
    _normalizeWithMap(text, opts = {}) {
      const ignoreSpaces = !!opts.ignoreSpaces;
      const src = text.normalize('NFC');
      let out = '';
      const indexMap = [];
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (this._isDropped(ch, ignoreSpaces)) continue;
        const mapped = this._transformChar(ch);
        for (const outCh of mapped) {out += outCh; indexMap.push(i);}
      }
      return {text:out, indexMap};
    },
    isDevanagari(text) {return /[\u0900-\u097F]/.test(text);},
    mapToOriginal(normPos, original, normalized, opts = {}) {
      const {indexMap} = this._normalizeWithMap(original, opts);
      if (normPos <= 0) return 0;
      if (normPos >= indexMap.length) return original.length;
      return indexMap[normPos];
    },
    search(query, text) {
      if (!query || !text) return [];
      const normQuery = this._normalizeWithMap(query, {ignoreSpaces:true}).text;
      const {text:normText, indexMap} = this._normalizeWithMap(text, {ignoreSpaces:true});
      if (!normQuery) return [];
      const matches = [];
      let fromIndex = 0;
      while (fromIndex <= normText.length) {
        const idx = normText.indexOf(normQuery, fromIndex);
        if (idx === -1) break;
        const startOrig = indexMap[idx];
        const endOrig = indexMap[idx + normQuery.length - 1] + 1;
        matches.push({start:startOrig, end:endOrig});
        fromIndex = idx + 1;
      }
      return matches;
    },
    matches(query, text) {return this.search(query, text).length > 0;}
  };
  const collator = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'});
  function validUrl(value) {
    if(typeof value!=='string' || /[\s\u0000-\u001f\u007f]/.test(value))return false;
    try {const url=new URL(value);return ['http:','https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;}catch{return false;}
  }
  const entries=(Array.isArray(data.entries)?data.entries:[]).filter(entry=>entry && typeof entry.subject==='string' && entry.subject.trim() && validUrl(entry.url)).map((entry,index)=>({subject:entry.subject,url:entry.url,id:String(index),sn:index+1,extension:new URL(entry.url).pathname.split('.').pop().toLocaleLowerCase()}));
  const state = {page:1, filtered:[], matches:[], activeMatch:-1, matchRanges:new Map(), matchedRows:0, hasSearch:false};
  const advancedIds = ['match-mode','search-field','subject-filter','url-filter','exclude-filter'];
  const defaults = {'match-mode':'all','search-field':'all','subject-filter':'','url-filter':'','exclude-filter':''};
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href',`#i-${name}`); svg.append(use); return svg;
  }
  function element(tag, className, text) {
    const e = document.createElement(tag); if (className) e.className = className;
    if (text !== undefined) e.textContent = text; return e;
  }
  function tokens(value) { return (clean(value).match(/"[^"]+"|[^\s,]+/g) || []).map(t => t.replace(/^"|"$/g,'')); }
  function advancedCount() {return advancedIds.filter(id => $(id).value !== defaults[id]).length;}
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity:'grapheme'}) : null;
  function searchableWithMap(value, normalized) {
    const source=String(value ?? ''), parts=segmenter ? segmenter.segment(source) : Array.from(source).map((segment,index,array)=>({segment,index:array.slice(0,index).join('').length}));
    let compatible='';const sourceMap=[];
    for(const part of parts){const text=part.segment.normalize('NFKC'),range={start:part.index,end:part.index+part.segment.length};compatible+=text;for(let i=0;i<text.length;i++)sourceMap.push(range);}
    // Fold the whole string so context-sensitive casing keeps its original behavior.
    const lowered=compatible.toLocaleLowerCase(),lowerMap=[];let offset=0;
    for(const ch of compatible){for(let i=0;i<ch.toLocaleLowerCase().length;i++)lowerMap.push(sourceMap[offset]);offset+=ch.length;}
    let text='';const indexMap=[];
    for(let i=0;i<lowered.length;i++){
      const ch=lowered[i];if(normalized && NepaliNormalizer._isDropped(ch,true))continue;
      if(!normalized && /\s/.test(ch) && (!text || text.endsWith(' ')))continue;
      const mapped=normalized ? NepaliNormalizer._transformChar(ch) : /\s/.test(ch) ? ' ' : ch;
      for(let j=0;j<mapped.length;j++){text+=mapped[j];indexMap.push(lowerMap[i] || lowerMap[lowerMap.length-1]);}
    }
    if(!normalized && text.endsWith(' ')){text=text.slice(0,-1);indexMap.pop();}
    return {text,indexMap};
  }
  function rangesForTerms(value, terms, normalized) {
    const {text,indexMap}=searchableWithMap(value,normalized),ranges=[];
    for(const term of new Set(terms.filter(Boolean))){let from=0;while(from<=text.length){const at=text.indexOf(term,from);if(at<0)break;const first=indexMap[at],last=indexMap[at+term.length-1];if(first && last)ranges.push({start:first.start,end:last.end});from=at+term.length;}}
    ranges.sort((a,b)=>a.start-b.start || a.end-b.end);const merged=[];
    for(const range of ranges){const last=merged[merged.length-1];if(last && range.start<last.end)last.end=Math.max(last.end,range.end);else merged.push({...range});}
    return merged;
  }
  function highlightedText(tag, className, text, ranges=[]) {
    const container=element(tag,className);let end=0;
    for(const range of ranges){container.append(document.createTextNode(text.slice(end,range.start)));const mark=element('mark','search-match',text.slice(range.start,range.end));mark.dataset.matchIndex=String(range.matchIndex);container.append(mark);end=range.end;}
    container.append(document.createTextNode(text.slice(end)));return container;
  }
  function getFiltered() {
    const normalized=$('nepali-normalized').checked;
    const searchText=value=>normalized?NepaliNormalizer.normalize(clean(value),{ignoreSpaces:true}):clean(value);
    const query=searchText($('search').value),queryTokens=tokens($('search').value).map(searchText).filter(Boolean),mode=$('match-mode').value,field=$('search-field').value;
    const subject=searchText($('subject-filter').value),url=searchText($('url-filter').value),excluded=tokens($('exclude-filter').value).map(searchText).filter(Boolean);
    const fullText=new Map();
    const candidates=entries.filter(entry=>{const full=searchText(`${entry.subject} ${entry.url}`);fullText.set(entry.id,full);return !excluded.some(word=>full.includes(word));});
    const matchesEntry=entry=>{
      if(subject && !searchText(entry.subject).includes(subject))return false;
      if(url && !searchText(entry.url).includes(url))return false;
      const haystack=field==='all'?fullText.get(entry.id):searchText(entry[field]);
      if(!query)return true;
      if(mode==='phrase')return haystack.includes(query.replace(/^"|"$/g,''));
      return mode==='any'?queryTokens.some(word=>haystack.includes(word)):queryTokens.every(word=>haystack.includes(word));
    };
    const matching=new Set(candidates.filter(matchesEntry).map(entry=>entry.id));
    const result=$('filter-rows').checked?candidates.filter(entry=>matching.has(entry.id)):candidates;
    const sort=$('sort').value;
    result.sort((a,b)=>sort==='entry-asc'?a.sn-b.sn:(sort==='subject-desc'?-1:1)*collator.compare(a.subject,b.subject)||a.sn-b.sn);
    state.hasSearch=!!(query||subject||url);state.matches=[];state.matchRanges=new Map();state.matchedRows=state.hasSearch?matching.size:0;
    if(state.hasSearch){
      const queryTerms=mode==='phrase'?[query.replace(/^"|"$/g,'')]:queryTokens;
      for(let entryIndex=0;entryIndex<result.length;entryIndex++){
        const entry=result[entryIndex];if(!matching.has(entry.id))continue;
        const terms={subject:subject?[subject]:[],url:url?[url]:[]};
        if(query){for(const key of ['subject','url'])if(field==='all'||field===key)terms[key].push(...queryTerms);}
        const ranges={};let visibleMatches=0;
        for(const key of ['subject','url']){
          ranges[key]=rangesForTerms(entry[key],terms[key],normalized);
          for(const range of ranges[key]){range.matchIndex=state.matches.length;state.matches.push({entryIndex,id:entry.id,field:key});visibleMatches++;}
        }
        if(!visibleMatches){ranges.rowMatchIndex=state.matches.length;state.matches.push({entryIndex,id:entry.id,field:null});}
        state.matchRanges.set(entry.id,ranges);
      }
    }
    return result;
  }
  function row(entry) {
    const tr=document.createElement('tr'),ranges=state.matchRanges.get(entry.id)||{};
    tr.dataset.entryId=entry.id;if(ranges.rowMatchIndex!==undefined)tr.dataset.matchIndex=String(ranges.rowMatchIndex);
    const subjectCell=element('td','subject-cell');subjectCell.append(highlightedText('span','subject-title',entry.subject,ranges.subject));
    const urlCell=element('td','url-cell'),a=element('a','open-link');a.href=entry.url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`Open URL: ${entry.subject}`);
    a.append(icon('eye'),highlightedText('span','url-text',entry.url,ranges.url));
    if(['pdf','png','jpg','jpeg','gif','webp','avif','bmp','svg'].includes(entry.extension))a.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();preview(entry);});
    urlCell.append(a);tr.append(element('td','sn',String(entry.sn)),subjectCell,urlCell);return tr;
  }
  function updateMatchNavigation() {
    const total=state.matches.length,current=state.activeMatch>=0 ? state.activeMatch+1 : 0;
    if($('match-count')){const label=total ? `${current ? `Match ${current} of ${total}` : `${total} matches`}, in ${state.matchedRows} matching ${state.matchedRows===1?'link':'links'}` : 'No search matches';$('match-count').textContent=`${current} / ${total}`;$('match-count').setAttribute('aria-label',label);$('match-count').title=label;}
    if($('match-previous'))$('match-previous').disabled=!total;if($('match-next'))$('match-next').disabled=!total;
    const active=$('link-rows').querySelector(`[data-match-index="${state.activeMatch}"]`);
    if(active){if(active.tagName==='MARK'){active.classList.add('search-match-active');active.setAttribute('aria-current','true');}active.closest('tr').classList.add('active-search-row');}
  }
  function scrollToActiveMatch() {
    const active=$('link-rows').querySelector(`[data-match-index="${state.activeMatch}"]`);if(!active)return;
    const bar=document.querySelector('.search-card'),top=active.getBoundingClientRect().top+window.scrollY-(bar ? bar.getBoundingClientRect().height+24 : 80);
    const reducedMotion=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:Math.max(0,top),behavior:reducedMotion?'auto':'smooth'});
  }
  function navigateMatch(direction) {
    if(timer){clearTimeout(timer);timer=null;state.page=1;render();state.activeMatch=-1;}
    const total=state.matches.length;if(!total)return;
    state.activeMatch=state.activeMatch<0 ? direction>0 ? 0 : total-1 : (state.activeMatch+direction+total)%total;
    state.page=Math.floor(state.matches[state.activeMatch].entryIndex/Number($('page-size').value))+1;render(true);scrollToActiveMatch();
  }
  function render(preserveMatch=false) {
    state.filtered=getFiltered();const n=state.filtered.length,size=Number($('page-size').value),pages=Math.max(1,Math.ceil(n/size));state.page=Math.min(state.page,pages);
    const start=(state.page-1)*size,end=Math.min(start+size,n),fragment=document.createDocumentFragment();
    if(!preserveMatch)state.activeMatch=state.matches.findIndex(match=>match.entryIndex>=start && match.entryIndex<end);
    for(let i=start;i<end;i++)fragment.append(row(state.filtered[i],i+1));$('link-rows').replaceChildren(fragment);
    $('total-pill').textContent=`${entries.length} ${entries.length===1?'link':'links'}`;
    $('result-summary').textContent=!$('filter-rows').checked && state.hasSearch?`${n} ${n===1?'link':'links'} shown · ${state.matchedRows} matching ${state.matchedRows===1?'link':'links'}`:n===entries.length?`${n} ${n===1?'link':'links'} in the catalogue`:`${n} of ${entries.length} links match`;
    const count=advancedCount();$('filter-count').hidden=!count;$('filter-count').textContent=count;
    $('clear-all').hidden=!($('search').value.trim()||count);
    $('empty-state').hidden=n>0;$('empty-reset').hidden=!entries.length;
    $('empty-title').textContent=entries.length?'No matching links':'No links added yet';
    $('empty-description').textContent=entries.length?'Try a different search or clear your filters.':'Use Add URL link to enter a subject and URL. Serial numbers are assigned automatically.';
    $('page-summary').textContent=n?`${start+1}–${end} of ${n} · Page ${state.page} of ${pages}`:'0 links';
    $('previous').disabled=state.page<=1;$('next').disabled=state.page>=pages;
    updateMatchNavigation();
  }
  function resetAdvanced() {for(const id of advancedIds){if($(id).type==='checkbox')$(id).checked=defaults[id];else $(id).value=defaults[id];}state.page=1;render();}
  function resetAll() {$('search').value='';resetAdvanced();$('search').focus();}
  function updateTopButton() {if($('go-top'))$('go-top').hidden=window.scrollY<300 || $('preview').open;}
  window.addEventListener('scroll',updateTopButton,{passive:true});
  $('go-top')?.addEventListener('click',()=>{
    const reducedMotion=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:0,behavior:reducedMotion?'auto':'smooth'});
  });
  updateTopButton();
  let nativePreviewFullscreen=false;
  function previewIsFullscreen() {return !!$('preview-shell') && document.fullscreenElement===$('preview-shell');}
  function setPreviewExpanded(expanded) {
    if(!$('preview-fullscreen'))return;
    $('preview').classList.toggle('preview-expanded',expanded);
    const button=$('preview-fullscreen'),label=expanded?'Exit fullscreen':'Enter fullscreen';
    button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',label);button.title=label;
    button.querySelector('use').setAttribute('href',expanded?'#i-collapse':'#i-expand');
    button.querySelector('span').textContent=expanded?'Exit full screen':'Full screen';
  }
  $('preview-fullscreen')?.addEventListener('click',async()=>{
    const dialog=$('preview'),shell=$('preview-shell'),button=$('preview-fullscreen');
    if(!dialog.open)return;
    button.disabled=true;
    try {
      if(dialog.classList.contains('preview-expanded')) {
        if(document.fullscreenElement===shell && document.exitFullscreen)await document.exitFullscreen();
        setPreviewExpanded(document.fullscreenElement===shell);
      } else {
        setPreviewExpanded(true);
        // Keep a full-window view when the browser cannot enter native fullscreen.
        if(shell.requestFullscreen && document.fullscreenEnabled) {
          try {await shell.requestFullscreen();}catch {/* The full-window view remains available. */}
        }
        if(!dialog.open && document.fullscreenElement===shell && document.exitFullscreen)await document.exitFullscreen();
        if(!dialog.open)setPreviewExpanded(false);
      }
    } catch {/* A browser-controlled fullscreen exit can be retried with Escape. */}
    finally {button.disabled=false;}
  });
  document.addEventListener('fullscreenchange',()=>{
    const active=previewIsFullscreen();
    if(active || nativePreviewFullscreen)setPreviewExpanded(active);
    nativePreviewFullscreen=active;
  });
  $('preview').addEventListener('cancel',event=>{
    if(!$('preview').classList.contains('preview-expanded'))return;
    event.preventDefault();
    if(previewIsFullscreen() && document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    else setPreviewExpanded(false);
  });
  function preview(entry) {
    const dialog=$('preview');setPreviewExpanded(false);$('preview-title').textContent=entry.subject;
    $('preview-note').textContent=entry.extension==='pdf'?'PDF preview · Use Open original if a preview is unavailable.':'Image preview';
    $('preview-original').href=entry.url;
    const content=$('preview-content');content.replaceChildren();
    if(entry.extension==='pdf'){const frame=document.createElement('iframe');frame.title=`PDF preview: ${entry.subject}`;frame.src=entry.url;content.append(frame);}
    else {const img=document.createElement('img');img.alt=entry.subject;img.src=entry.url;img.addEventListener('error',()=>{content.replaceChildren(element('p','preview-fallback','Preview unavailable. Use Open original to view the link.'));},{once:true});content.append(img);}
    dialog.showModal();$('preview-close').focus();updateTopButton();
  }
  $('preview-close').addEventListener('click',()=>$('preview').close());
  $('preview').addEventListener('close',()=>{
    if(previewIsFullscreen() && document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    setPreviewExpanded(false);$('preview-content').replaceChildren();updateTopButton();
  });
  $('preview').addEventListener('click',e=>{if(e.target===$('preview')){const r=$('preview').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('preview').close();}});
  $('advanced-toggle').addEventListener('click',()=>{const open=$('advanced').hidden;$('advanced').hidden=!open;$('advanced-toggle').setAttribute('aria-expanded',String(open));});
  let timer; for(const id of ['search','nepali-normalized','filter-rows',...advancedIds]){const control=$(id);control?.addEventListener(control.tagName==='SELECT'||control.type==='checkbox'?'change':'input',()=>{clearTimeout(timer);timer=setTimeout(()=>{timer=null;state.page=1;render();},100);});}
  $('match-previous')?.addEventListener('click',()=>navigateMatch(-1));$('match-next')?.addEventListener('click',()=>navigateMatch(1));
  $('search').addEventListener('keydown',event=>{if(event.key!=='Enter' || event.isComposing)return;event.preventDefault();navigateMatch(event.shiftKey?-1:1);});
  $('reset-advanced').addEventListener('click',resetAdvanced);$('clear-all').addEventListener('click',resetAll);$('empty-reset').addEventListener('click',resetAll);
  $('sort').addEventListener('change',()=>{state.page=1;render();});
  $('sort-subject').addEventListener('click',()=>{$('sort').value=$('sort').value==='subject-asc'?'subject-desc':'subject-asc';state.page=1;render();});
  $('page-size').addEventListener('change',()=>{state.page=1;render();});$('previous').addEventListener('click',()=>{if(state.page>1)state.page--;render();});$('next').addEventListener('click',()=>{state.page++;render();});
  document.addEventListener('keydown',e=>{const editing=['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable;if(e.key==='/'&&!editing&&!e.ctrlKey&&!e.metaKey&&!$('preview').open){e.preventDefault();$('search').focus();}if(e.key==='Escape'&&e.target===$('search')){$('search').value='';state.page=1;render();}});
  if(data.generatedAt){const date=new Date(data.generatedAt);if(!Number.isNaN(date.valueOf()))$('updated-at').textContent=`Catalogue updated ${date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`;}
  render();
  if(!window.BIBIDH_INDEX){$('result-summary').textContent='Catalogue index could not load. Please refresh the page.';$('empty-title').textContent='Catalogue unavailable';$('empty-description').textContent='Please refresh the page or check that links-index.js is available.';}
})();
