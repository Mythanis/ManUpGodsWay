import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import MobilePdfViewer from '@/components/MobilePdfViewer';
import { BackButton } from "@/components/BackButton";

interface Study {
  id: string;
  title: string;
  pdfOriginalName?: string;
}

export default function DocumentViewer() {
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
    window.open(`/api/studies/${id}/pdf-file`, '_blank');
  };

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-ministry-slate">Study ID not found</p>
      </div>
    );
  }

  return (
    <MobilePdfViewer
      pdfUrl={`/api/studies/${id}/pdf-file`}
      studyTitle={study?.pdfOriginalName || study?.title || 'Document'}
      onBack={handleBack}
      onDownload={handleDownload}
    />
  );
}
