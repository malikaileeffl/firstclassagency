/* First Class Agency — daily training-call calendar.
   Single source of truth for the Mon–Fri call lineup. Edit this file when the
   training schedule changes; both the dashboard and the admin attendance
   breakdown read from window.FCA_SCHEDULE on load.

   Each entry needs:
     day   — short day code: Mon | Tue | Wed | Thu | Fri
     topic — call topic shown to agents
     host  — host name shown to agents
*/
window.FCA_SCHEDULE = [
  { day: 'Mon', topic: 'Team Call',           host: 'Drew Smith & Wylie Hawkins' },
  { day: 'Tue', topic: 'Lead Flow',           host: 'Garrett Sekelsky' },
  { day: 'Wed', topic: 'Financial Inventory', host: 'Hayden Keltner' },
  { day: 'Thu', topic: 'Setting/Hitting Goals', host: 'Colby Whittaker' },
  { day: 'Fri', topic: 'Get the Smoke',       host: 'Drew Smith' },
];
