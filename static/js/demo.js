// Demo-site glue (not part of agentprose): make "Try the agent tools" open the inspector panel.
(function () {
  function panel() { var h = document.getElementById('agentprose-inspector'); return h && h.shadowRoot && h.shadowRoot.querySelector('.panel'); }
  function open() { var p = panel(); if (p) { p.hidden = false; return true; } return false; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-open-inspector]');
    if (a && open()) e.preventDefault();
  });
  if (/[?&]agentprose-inspect/.test(location.search)) {
    var t0 = Date.now();
    (function poll() { if (!open() && Date.now() - t0 < 15000) setTimeout(poll, 250); })();
  }
})();
