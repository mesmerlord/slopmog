import type { GetServerSideProps } from "next";

// Redirect old campaigns/new route to new sites/new route
export default function CampaignNewRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/dashboard/sites/new",
      permanent: true,
    },
  };
};
