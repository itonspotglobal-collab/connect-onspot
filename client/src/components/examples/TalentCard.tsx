import { TalentCard } from '../TalentCard'
//todo: remove mock functionality
import avatarImage from '@assets/generated_images/Professional_talent_avatar_71613d75.png'

export default function TalentCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 max-w-6xl">
      <TalentCard
        id="talent-1"
        name="Sarah Chen"
        role="Senior Full Stack Developer"
        location="San Francisco, CA"
        hourlyRate={85}
        rating={4.9}
        skills={["React", "Node.js", "TypeScript", "Python", "AWS"]}
        avatarUrl={avatarImage}
        experience="5+ years"
        availability="available"
      />
      <TalentCard
        id="talent-2"
        name="Marcus Rodriguez"
        role="UI/UX Designer"
        location="New York, NY"
        hourlyRate={75}
        rating={4.8}
        skills={["Figma", "Adobe Creative Suite", "Prototyping", "User Research"]}
        experience="4+ years"
        availability="busy"
      />
      <TalentCard
        id="talent-3"
        name="Priya Sharma"
        role="Data Analyst"
        location="Remote"
        hourlyRate={65}
        rating={4.7}
        skills={["Python", "SQL", "Tableau", "Machine Learning"]}
        experience="3+ years"
        availability="offline"
      />
    </div>
  )
}