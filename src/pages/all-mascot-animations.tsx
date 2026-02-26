import type { GetStaticProps } from "next";
import dynamic from "next/dynamic";
import fs from "fs";
import path from "path";
import Head from "next/head";

interface Props {
  files: string[];
}

export const getStaticProps: GetStaticProps<Props> = () => {
  const dir = path.join(process.cwd(), "src/components/illustrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(".tsx", ""));
  return { props: { files } };
};

export default function AllMascotAnimations({ files }: Props) {
  return (
    <>
      <Head>
        <title>All Mascot Animations | SlopMog</title>
      </Head>
      <div className="min-h-screen bg-brand-cream px-6 py-12">
        <h1 className="font-heading text-3xl font-bold text-brand-charcoal text-center mb-10">
          All Mascot Animations
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {files.map((name) => {
            const Component = dynamic(
              () => import(`@/components/illustrations/${name}`),
              { ssr: false }
            );
            return (
              <div
                key={name}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col items-center gap-4"
              >
                <div className="w-full h-64 flex items-center justify-center">
                  <Component />
                </div>
                <p className="font-heading text-sm font-semibold text-brand-charcoal">
                  {name}.tsx
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
