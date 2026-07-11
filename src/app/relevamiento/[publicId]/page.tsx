import IntakeWizard from "@/components/intake/IntakeWizard";

export default async function IntakePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <IntakeWizard publicId={publicId} />;
}
