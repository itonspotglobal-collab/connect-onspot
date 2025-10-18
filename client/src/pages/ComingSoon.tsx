import { useEffect } from "react";
import { ComingSoon as ComingSoonComponent } from "@/components/ComingSoon";

export default function ComingSoon() {
  useEffect(() => {
    // Set page title and meta description
    document.title = "Coming Soon | OnSpot";
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'The next evolution of outsourcing is coming soon. Powered by intelligence and human brilliance. OnSpot is preparing an extraordinary experience.');
    
    // Cleanup function to restore original title when component unmounts
    return () => {
      document.title = "OnSpot - Making Outsourcing Easy";
    };
  }, []);

  // Render full-screen immersive experience without navigation
  return (
    <div className="fixed inset-0 w-full h-full">
      <ComingSoonComponent />
    </div>
  );
}