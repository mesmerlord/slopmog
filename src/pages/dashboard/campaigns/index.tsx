import type { GetServerSideProps } from "next";

// Redirect old campaigns route to new sites route
export default function CampaignsRedirect() {
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
