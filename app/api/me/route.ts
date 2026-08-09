import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json({ email: user.email, displayName: user.fullName || user.email.split("@")[0] });
}
