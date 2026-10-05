import { DEMO_PASSWORD, DIRECTORY, type DirectoryEntry } from './directory.ts'

export interface AuthParams {
  client_id: string
  redirect_uri: string
  response_type: string
  scope: string
  state: string
  nonce: string
  code_challenge: string
  code_challenge_method: string
  prompt: string
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const hidden = (p: AuthParams) =>
  Object.entries(p)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join('')

const layout = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Campus SSO (demo)</title>
<style>
  :root { --ink:#1b1d24; --muted:#636774; --line:#e3e5ea; --brand:#1d2b4f; --accent:#f5c518; }
  * { box-sizing:border-box }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:#eef0f4;
         font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif; color:var(--ink) }
  .card { width:100%; max-width:400px; background:#fff; border-radius:14px; box-shadow:0 10px 40px -12px #1d2b4f40; overflow:hidden }
  .top { background:var(--brand); color:#fff; padding:18px 24px; display:flex; align-items:center; gap:10px }
  .logo { width:30px; height:30px; border-radius:7px; background:var(--accent); color:var(--brand); display:grid; place-items:center; font-weight:800 }
  .top b { font-size:16px } .top small { display:block; opacity:.7; font-size:12px }
  .demo { background:#fff7d6; color:#7a5b00; font-size:12px; padding:8px 24px; border-bottom:1px solid #f1e3a6 }
  main { padding:22px 24px 24px }
  h1 { font-size:20px; margin:0 0 4px } p.sub { color:var(--muted); margin:0 0 18px; font-size:14px }
  label { display:block; font-size:13px; font-weight:600; margin:12px 0 5px }
  input[type=text], input[type=password] { width:100%; padding:11px 12px; border:1px solid var(--line); border-radius:8px; font:inherit }
  input:focus { outline:2px solid #3b5bdb55; border-color:#3b5bdb }
  button { font:inherit; cursor:pointer }
  .primary { width:100%; margin-top:18px; padding:12px; border:0; border-radius:8px; background:var(--brand); color:#fff; font-weight:700 }
  .ghost { width:100%; margin-top:8px; padding:10px; border:0; background:none; color:var(--muted) }
  .err { background:#fdecec; color:#a4262c; padding:9px 12px; border-radius:8px; font-size:13px; margin-bottom:6px }
  details { margin-top:18px; border-top:1px solid var(--line); padding-top:12px; font-size:13px; color:var(--muted) }
  summary { cursor:pointer; font-weight:600 }
  .acct { display:flex; justify-content:space-between; width:100%; padding:7px 9px; margin-top:4px; border:1px solid var(--line); border-radius:7px; background:#fafbfc; text-align:left; font-size:13px }
  .acct:hover { border-color:#3b5bdb }
  .who { display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--line); border-radius:10px }
  .avatar { width:40px; height:40px; border-radius:50%; background:#dfe5f5; display:grid; place-items:center; font-weight:700; color:var(--brand) }
  .app { font-size:13px; color:var(--muted); background:#f6f7f9; padding:10px 12px; border-radius:8px; margin-top:14px }
</style></head>
<body><div class="card">
  <div class="top"><div class="logo">U</div><div><b>Campus SSO</b><small>University single sign-on</small></div></div>
  <div class="demo">⚠️ Demo identity provider — stands in for your university's real login.</div>
  <main>${body}</main>
</div></body></html>`

export function loginPage(p: AuthParams, error?: string) {
  const accounts = DIRECTORY.map(
    (u) =>
      `<button type="button" class="acct" data-zid="${esc(u.zid)}"><span>${esc(u.name)}</span><span>${esc(u.zid)}${
        u.loop ? '' : u.email.endsWith('unsw.edu.au') ? ' · new' : ' · other uni'
      }</span></button>`,
  ).join('')

  return layout(
    'Sign in',
    `<h1>Sign in</h1>
     <p class="sub"><b>Loop</b> wants to verify you're a current student.</p>
     ${error ? `<div class="err">${esc(error)}</div>` : ''}
     <form method="post" action="/authorize" autocomplete="off">
       ${hidden(p)}
       <label for="login">zID or university email</label>
       <input id="login" name="login" type="text" placeholder="z5300001" required autofocus>
       <label for="password">Password</label>
       <input id="password" name="password" type="password" required>
       <button class="primary" name="action" value="login">Sign in</button>
       <button class="ghost" name="action" value="cancel" formnovalidate>Cancel</button>
     </form>
     <details open>
       <summary>Demo accounts (password: <code>${esc(DEMO_PASSWORD)}</code>)</summary>
       ${accounts}
     </details>
     <script>
       document.querySelectorAll('.acct').forEach(b => b.onclick = () => {
         document.getElementById('login').value = b.dataset.zid;
         document.getElementById('password').value = ${JSON.stringify(DEMO_PASSWORD)};
         document.getElementById('password').focus();
       });
     </script>`,
  )
}

export function accountChooserPage(p: AuthParams, user: DirectoryEntry) {
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  return layout(
    'Continue',
    `<h1>Welcome back</h1>
     <p class="sub">You're already signed in to Campus SSO.</p>
     <div class="who"><div class="avatar">${esc(initials)}</div>
       <div><b>${esc(user.name)}</b><br><span style="color:var(--muted);font-size:13px">${esc(user.email)}</span></div></div>
     <div class="app">Loop will receive your <b>name</b>, <b>email</b> and a unique student identifier.</div>
     <form method="post" action="/authorize">
       ${hidden(p)}
       <button class="primary" name="action" value="continue">Continue as ${esc(user.name.split(' ')[0])}</button>
     </form>
     <form method="get" action="/authorize">
       ${hidden({ ...p, prompt: 'login' })}
       <button class="ghost">Use a different account</button>
     </form>`,
  )
}

export const errorPage = (message: string, title = 'Sign-in error') =>
  layout(title, `<h1>${esc(title)}</h1><p class="sub">${esc(message)}</p>`)
