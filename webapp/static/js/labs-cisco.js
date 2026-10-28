/* WCN Virtual Lab - Cisco networking labs (problems to be added) */
"use strict";

App.register({
  id: "cisco", num: "C1", group: "cisco", icon: "🌐", soon: true,
  title: "Cisco Packet Tracer Labs",
  summary: "Router, switch and wireless configuration problems. The problem statements will be added here.",
  tabs: [["experiment", "🧪 Experiment"]],
  experiment(body) {
    body.innerHTML = `<div class="panel"><div class="empty" style="padding:40px">
      <div style="font-size:2.2rem">🌐</div>
      <h2>Cisco labs coming soon</h2>
      <p class="muted">This section is reserved for the Cisco problems. Each one will get the same lab layout:<br>
      an interactive topology, a CLI console to type IOS commands, verification checks, theory and viva.</p></div></div>`;
  },
});
