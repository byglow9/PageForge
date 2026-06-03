import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>PageForge</h1>
      <p>Landing page generation platform for agencies and marketing teams.</p>
      <nav>
        <Link href="/login">Log in</Link>
        {" | "}
        <Link href="/signup">Sign up</Link>
      </nav>
    </main>
  );
}
