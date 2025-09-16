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
    metaDescription.setAttribute('content', 'Something amazing is coming to OnSpot! We\'re crafting an incredible experience just for you. Stay tuned for exciting new features and capabilities.');
    
    // Cleanup function to restore original title when component unmounts
    return () => {
      document.title = "OnSpot - Making Outsourcing Easy";
    };
  }, []);

  return <ComingSoonComponent />;
}