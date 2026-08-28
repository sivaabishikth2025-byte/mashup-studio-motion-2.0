"use client";

export default function ErrorView({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="font-serif text-4xl">Something snapped in the mashup.</h1>
        <p className="mt-3 text-white/60">{error.message}</p>
        <button className="mt-6 rounded-full bg-white px-5 py-2 text-black" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
