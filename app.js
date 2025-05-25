function login() {
  console.log("ログイン処理");
  // 後で本当のログイン処理をここに書く
}
function showRegister() {
  console.log("新規登録表示");
}
function register() {
  console.log("登録処理");
}
function backToLogin() {
  console.log("ログイン画面に戻る");
}

// グローバルに公開（HTML側の onclick から使えるように）
window.login = login;
window.showRegister = showRegister;
window.register = register;
window.backToLogin = backToLogin;
