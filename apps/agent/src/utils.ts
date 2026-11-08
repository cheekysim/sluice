export async function getPublicIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    console.log("Public IP fetched successfully:", data.ip);
    return data.ip;
  } catch {
    return "127.0.0.1";
  }
}
