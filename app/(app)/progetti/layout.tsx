'use client';

export default function ProgettiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
       <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progetti</h1>
      </div>
      <div>{children}</div>
    </div>
  );
}
