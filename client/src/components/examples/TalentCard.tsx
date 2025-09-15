import { TalentCard } from '../TalentCard'
//todo: remove mock functionality
import avatarImage from '@assets/generated_images/Professional_talent_avatar_71613d75.png'

export default function TalentCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 max-w-6xl">
      <TalentCard
        id="talent-1"
        name="Maria Santos"
        role="Senior Full Stack Developer"
        location="Manila, Philippines"
        hourlyRate={25}
        rating={4.9}
        skills={["React", "Node.js", "TypeScript", "Python", "AWS"]}
        avatarUrl={avatarImage}
        experience="5+ years"
        availability="available"
      />
      <TalentCard
        id="talent-2"
        name="Carlos Reyes"
        role="Customer Support Specialist"
        location="Cebu, Philippines"
        hourlyRate={8}
        rating={4.8}
        skills={["English Fluency", "CRM Management", "Technical Support", "Customer Service"]}
        experience="3+ years"
        availability="available"
      />
      <TalentCard
        id="talent-3"
        name="Ana Dela Cruz"
        role="Virtual Assistant"
        location="Davao, Philippines"
        hourlyRate={6}
        rating={4.7}
        skills={["Admin Support", "Data Entry", "Social Media", "Lead Generation"]}
        experience="4+ years"
        availability="available"
      />
    </div>
  )
}