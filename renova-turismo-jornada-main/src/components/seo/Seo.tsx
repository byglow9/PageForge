import { Helmet } from "react-helmet-async";

const SITE_URL = "https://renova-turismo-jornada.lovable.app";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const Seo = ({ title, description, path, image, type = "website", jsonLd }: SeoProps) => {
  const url = `${SITE_URL}${path}`;
  const ogImage = image ?? "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/75f34933-124a-44c9-ba01-954a06d792b5/id-preview-a3573e5d--d2374d05-c25e-4038-8d13-c101635652ce.lovable.app-1775140278405.png";
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export default Seo;
