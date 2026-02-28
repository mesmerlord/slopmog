import type { GetServerSideProps } from "next";

// Redirect old campaign detail route to sites list
export default function CampaignDetailRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/dashboard/sites",
      permanent: true,
    },
  };
};
