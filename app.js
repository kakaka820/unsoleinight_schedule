function login() {
  alert("ログインボタンが押されました！");
}

// グローバルに公開（HTMLのonclickから呼べるように）
window.login = login;

