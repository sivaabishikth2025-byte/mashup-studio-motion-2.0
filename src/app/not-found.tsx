import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">404</p>
        <h1 className="mt-3 font-serif text-4xl">This mashup never existed.</h1>
        <Link className="mt-6 inline-block text-fuchsia-300 underline" href="/">
          Back to the studio
        </Link>
      </div>
    </div>
  );
}
