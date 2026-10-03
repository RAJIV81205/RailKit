import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";
import { RailAtlas } from "../../components/rail-atlas/RailAtlas";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Rail Atlas — Indian Railway Stations & Routes",
    description: "Browse mapped Indian railway stations and explore the country's OpenStreetMap railway network.",
    path: "/rail-atlas",
  }),
};

export default function RailAtlasPage() {
  return <RailAtlas />;
}
