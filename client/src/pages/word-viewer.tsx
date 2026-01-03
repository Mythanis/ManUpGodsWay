import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import UserInteractiveWordViewer from '@/components/UserInteractiveWordViewer';
import { BackButton } from "@/components/BackButton";

interface Study {
  id: string;
  title: string;
  wordOriginalName?: string;
}

export default function WordViewer() {
  const { id } = useParams();
  const [, navigate] = useLocation();

  // Fetch study details
  const { data: study } = useQuery<Study>({
    queryKey: [`/api/studies/${id}`],
    enabled: !!id,
  });

  const handleBack = () => {
    navigate(`/studies/${id}`);
  };

  const handleDownload = () => {
    window.open(`/api/studies/${id}/word-file`, '_blank');
  };

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-ministry-slate">Study ID not found</p>
      </div>
    );
  }

  const isDocFile = study?.wordOriginalName?.toLowerCase().endsWith('.doc') || false;

  return (
    <UserInteractiveWordViewer
      studyId={id}
      wordHtmlUrl={`/api/studies/${id}/word-html`}
      wordFileUrl={`/api/studies/${id}/word-file`}
      studyTitle={study?.wordOriginalName || study?.title || 'Document'}
      isDocFile={isDocFile}
      onBack={handleBack}
      onDownload={handleDownload}
    />
  );
}
