// navigator.clipboard only exists in a secure context, so it is undefined on
// http://<LAN-IP> — exactly where a judge's phone loads the study from. One
// helper so every copy button degrades to "select the text" instead of
// silently doing nothing.
export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
