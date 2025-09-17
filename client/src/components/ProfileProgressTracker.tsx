import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Trophy,
  Star,
  CheckCircle2,
  Target,
  TrendingUp,
  Users,
  Eye,
  Award,
  Briefcase,
  User,
  Play,
  Upload,
  Zap,
  Crown,
  Medal,
  Sparkles,
  ChevronRight,
  ArrowUp,
  TrendingDown,
  Calendar,
  Clock,
  Gift,
  Rocket,
  Shield,
  Diamond,
  Flame,
  Globe,
  Heart,
  Lightbulb,
  Magic
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentProfile } from "@/hooks/useTalentProfile";

interface ProfileLevel {
  level: number;
  name: string;
  minCompletion: number;
  maxCompletion: number;
  color: string;
  icon: React.ReactNode;
  benefits: string[];
  nextLevelReward: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  points: number;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
  dateUnlocked?: Date;
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  action: string;
  impact: "low" | "medium" | "high";
  timeEstimate: string;
  points: number;
  priority: number;
  category: string;
  icon: React.ReactNode;
}

interface ProfileProgressTrackerProps {
  className?: string;
  mode?: "full" | "compact" | "dashboard";
  onActionClick?: (actionId: string) => void;
}

const PROFILE_LEVELS: ProfileLevel[] = [
  {
    level: 1,
    name: "Newcomer",
    minCompletion: 0,
    maxCompletion: 24,
    color: "bg-gray-500",
    icon: <User className="w-4 h-4" />,
    benefits: ["Basic profile visibility", "Access to entry-level jobs"],
    nextLevelReward: "Verified badge + Featured in search"
  },
  {
    level: 2,
    name: "Explorer",
    minCompletion: 25,
    maxCompletion: 49,
    color: "bg-green-500",
    icon: <Eye className="w-4 h-4" />,
    benefits: ["Verified badge", "Featured in search results"],
    nextLevelReward: "Priority support + Profile boost"
  },
  {
    level: 3,
    name: "Professional",
    minCompletion: 50,
    maxCompletion: 74,
    color: "bg-blue-500",
    icon: <Briefcase className="w-4 h-4" />,
    benefits: ["Priority support", "Profile boost", "Advanced analytics"],
    nextLevelReward: "Expert status + Premium placement"
  },
  {
    level: 4,
    name: "Expert",
    minCompletion: 75,
    maxCompletion: 89,
    color: "bg-purple-500",
    icon: <Award className="w-4 h-4" />,
    benefits: ["Expert status", "Premium placement", "Direct client access"],
    nextLevelReward: "Elite status + Top talent showcase"
  },
  {
    level: 5,
    name: "Elite",
    minCompletion: 90,
    maxCompletion: 100,
    color: "bg-yellow-500",
    icon: <Crown className="w-4 h-4" />,
    benefits: ["Elite status", "Top talent showcase", "Exclusive opportunities"],
    nextLevelReward: "Maximum visibility and earning potential"
  }
];

const ACHIEVEMENTS_DATA: Achievement[] = [
  {
    id: "first_steps",
    title: "First Steps",
    description: "Complete your basic profile information",
    icon: <User className="w-4 h-4" />,
    category: "Profile",
    rarity: "common",
    points: 50,
    unlocked: false
  },
  {
    id: "skill_collector",
    title: "Skill Collector",
    description: "Add 5 skills to your profile",
    icon: <Star className="w-4 h-4" />,
    category: "Skills",
    rarity: "common",
    points: 100,
    unlocked: false,
    progress: 0,
    maxProgress: 5
  },
  {
    id: "skill_master",
    title: "Skill Master",
    description: "Add 15 skills to your profile",
    icon: <Crown className="w-4 h-4" />,
    category: "Skills", 
    rarity: "rare",
    points: 250,
    unlocked: false,
    progress: 0,
    maxProgress: 15
  },
  {
    id: "portfolio_starter",
    title: "Portfolio Starter",
    description: "Add your first portfolio item",
    icon: <Briefcase className="w-4 h-4" />,
    category: "Portfolio",
    rarity: "common",
    points: 150,
    unlocked: false
  },
  {
    id: "portfolio_pro",
    title: "Portfolio Pro",
    description: "Add 5 portfolio items",
    icon: <Trophy className="w-4 h-4" />,
    category: "Portfolio",
    rarity: "rare",
    points: 400,
    unlocked: false,
    progress: 0,
    maxProgress: 5
  },
  {
    id: "certified_talent",
    title: "Certified Talent",
    description: "Add professional certifications",
    icon: <Medal className="w-4 h-4" />,
    category: "Credentials",
    rarity: "rare",
    points: 200,
    unlocked: false
  },
  {
    id: "video_star",
    title: "Video Star",
    description: "Upload a video introduction",
    icon: <Play className="w-4 h-4" />,
    category: "Media",
    rarity: "epic",
    points: 300,
    unlocked: false
  },
  {
    id: "profile_complete",
    title: "Profile Perfectionist",
    description: "Achieve 100% profile completion",
    icon: <Diamond className="w-4 h-4" />,
    category: "Profile",
    rarity: "legendary",
    points: 500,
    unlocked: false
  },
  {
    id: "early_adopter",
    title: "Early Adopter",
    description: "Join OnSpot in the first month",
    icon: <Rocket className="w-4 h-4" />,
    category: "Special",
    rarity: "epic",
    points: 250,
    unlocked: false
  }
];

export default function ProfileProgressTracker({ 
  className, 
  mode = "full", 
  onActionClick 
}: ProfileProgressTrackerProps) {
  const {
    profile,
    skills,
    documents,
    profileCompletion,
    isLoading
  } = useTalentProfile();

  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS_DATA);
  const [totalPoints, setTotalPoints] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<ProfileLevel>(PROFILE_LEVELS[0]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Calculate achievements and level
  useEffect(() => {
    updateAchievements();
    updateCurrentLevel();
    generateSuggestions();
  }, [profile, skills, documents, profileCompletion]);

  const updateAchievements = () => {
    const updatedAchievements = achievements.map(achievement => {
      let unlocked = achievement.unlocked;
      let progress = achievement.progress || 0;
      
      switch (achievement.id) {
        case "first_steps":
          unlocked = !!(profile?.firstName && profile?.lastName && profile?.title);
          break;
        case "skill_collector":
          progress = skills?.length || 0;
          unlocked = progress >= 5;
          break;
        case "skill_master":
          progress = skills?.length || 0;
          unlocked = progress >= 15;
          break;
        case "portfolio_starter":
          // Would check portfolio items
          unlocked = false;
          break;
        case "portfolio_pro":
          // Would check portfolio items
          progress = 0; // Replace with actual portfolio count
          unlocked = progress >= 5;
          break;
        case "certified_talent":
          // Would check certifications
          unlocked = false;
          break;
        case "video_star":
          unlocked = documents?.some(doc => doc.type === "video_intro") || false;
          break;
        case "profile_complete":
          unlocked = profileCompletion >= 100;
          break;
        case "early_adopter":
          // Would check registration date
          unlocked = false;
          break;
      }
      
      // Set unlock date if newly unlocked
      if (unlocked && !achievement.unlocked) {
        return { ...achievement, unlocked, progress, dateUnlocked: new Date() };
      }
      
      return { ...achievement, unlocked, progress };
    });

    setAchievements(updatedAchievements);
    
    const points = updatedAchievements
      .filter(achievement => achievement.unlocked)
      .reduce((sum, achievement) => sum + achievement.points, 0);
    setTotalPoints(points);
  };

  const updateCurrentLevel = () => {
    const level = PROFILE_LEVELS.find(l => 
      profileCompletion >= l.minCompletion && profileCompletion <= l.maxCompletion
    ) || PROFILE_LEVELS[0];
    setCurrentLevel(level);
  };

  const generateSuggestions = () => {
    const newSuggestions: Suggestion[] = [];

    // Basic info suggestions
    if (!profile?.firstName || !profile?.lastName) {
      newSuggestions.push({
        id: "complete_basic_info",
        title: "Complete Basic Information",
        description: "Add your name and professional title",
        action: "Fill basic details",
        impact: "high",
        timeEstimate: "2 min",
        points: 150,
        priority: 1,
        category: "Profile",
        icon: <User className="w-4 h-4" />
      });
    }

    // Bio suggestion
    if (!profile?.bio || profile.bio.length < 50) {
      newSuggestions.push({
        id: "write_bio",
        title: "Write Professional Bio",
        description: "Tell clients about your expertise and experience",
        action: "Write bio",
        impact: "high",
        timeEstimate: "5 min",
        points: 200,
        priority: 2,
        category: "Profile",
        icon: <Briefcase className="w-4 h-4" />
      });
    }

    // Skills suggestion
    if (!skills || skills.length < 5) {
      newSuggestions.push({
        id: "add_skills",
        title: "Add More Skills",
        description: "Showcase your expertise with relevant skills",
        action: "Add skills",
        impact: "medium",
        timeEstimate: "3 min",
        points: 100,
        priority: 3,
        category: "Skills",
        icon: <Star className="w-4 h-4" />
      });
    }

    // Video intro suggestion
    if (!documents?.some(doc => doc.type === "video_intro")) {
      newSuggestions.push({
        id: "add_video",
        title: "Record Video Introduction",
        description: "Stand out with a personal video introduction",
        action: "Record video",
        impact: "high",
        timeEstimate: "10 min",
        points: 300,
        priority: 4,
        category: "Media",
        icon: <Play className="w-4 h-4" />
      });
    }

    // Portfolio suggestion
    newSuggestions.push({
      id: "add_portfolio",
      title: "Showcase Your Work",
      description: "Add portfolio items to demonstrate your abilities",
      action: "Add portfolio",
      impact: "high",
      timeEstimate: "15 min",
      points: 250,
      priority: 5,
      category: "Portfolio",
      icon: <Trophy className="w-4 h-4" />
    });

    // Sort by priority and take top suggestions
    setSuggestions(newSuggestions.sort((a, b) => a.priority - b.priority).slice(0, 5));
  };

  const getRarityColor = (rarity: Achievement["rarity"]) => {
    switch (rarity) {
      case "common": return "text-gray-600 bg-gray-100";
      case "rare": return "text-blue-600 bg-blue-100";
      case "epic": return "text-purple-600 bg-purple-100";
      case "legendary": return "text-yellow-600 bg-yellow-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getImpactColor = (impact: Suggestion["impact"]) => {
    switch (impact) {
      case "low": return "text-gray-600 bg-gray-100";
      case "medium": return "text-orange-600 bg-orange-100";
      case "high": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const nextLevel = PROFILE_LEVELS.find(l => l.level === currentLevel.level + 1);
  const progressInCurrentLevel = ((profileCompletion - currentLevel.minCompletion) / (currentLevel.maxCompletion - currentLevel.minCompletion)) * 100;
  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const recentAchievements = unlockedAchievements
    .filter(a => a.dateUnlocked)
    .sort((a, b) => (b.dateUnlocked?.getTime() || 0) - (a.dateUnlocked?.getTime() || 0))
    .slice(0, 3);

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact mode for embedded use
  if (mode === "compact") {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", currentLevel.color)}>
                {currentLevel.icon}
              </div>
              <div>
                <div className="font-medium text-sm">{currentLevel.name}</div>
                <div className="text-xs text-muted-foreground">{totalPoints} points</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{profileCompletion}%</div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
          
          <Progress value={profileCompletion} className="h-2 mb-2" />
          
          {nextLevel && (
            <div className="text-xs text-muted-foreground">
              {nextLevel.maxCompletion - profileCompletion}% to {nextLevel.name}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Dashboard mode for main dashboard
  if (mode === "dashboard") {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{profileCompletion}%</div>
              <div className="text-sm text-muted-foreground">Profile Complete</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{totalPoints}</div>
              <div className="text-sm text-muted-foreground">Total Points</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{unlockedAchievements.length}</div>
              <div className="text-sm text-muted-foreground">Achievements</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white", currentLevel.color)}>
                  {currentLevel.icon}
                </div>
                <div className="text-lg font-bold">{currentLevel.name}</div>
              </div>
              <div className="text-sm text-muted-foreground">Current Level</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Achievements */}
        {recentAchievements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Recent Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto">
                {recentAchievements.map(achievement => (
                  <div 
                    key={achievement.id}
                    className="flex-shrink-0 w-48 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center text-white">
                        {achievement.icon}
                      </div>
                      <Badge className={getRarityColor(achievement.rarity)}>
                        {achievement.rarity}
                      </Badge>
                    </div>
                    <div className="font-medium text-sm">{achievement.title}</div>
                    <div className="text-xs text-muted-foreground">{achievement.description}</div>
                    <div className="text-xs font-medium text-yellow-600 mt-1">+{achievement.points} pts</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className={cn("space-y-6", className)}>
      {/* Level Progress Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary-dark/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center text-white shadow-lg", currentLevel.color)}>
                {currentLevel.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-2xl font-bold">{currentLevel.name}</h3>
                  <Badge variant="secondary">Level {currentLevel.level}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {currentLevel.benefits.join(" • ")}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-muted opacity-20"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeDasharray={`${profileCompletion * 2.26} 226`}
                    className={cn("transition-all duration-1000 ease-out", currentLevel.color.replace('bg-', 'text-'))}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold">{profileCompletion}%</span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{totalPoints} points</div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {nextLevel && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Progress to {nextLevel.name}</span>
                <span>{Math.round(progressInCurrentLevel)}%</span>
              </div>
              <Progress value={progressInCurrentLevel} className="h-2" />
              <Alert className="border-primary/20 bg-primary/5">
                <Gift className="w-4 h-4 text-primary" />
                <AlertDescription className="text-primary">
                  <strong>Next reward:</strong> {nextLevel.nextLevelReward}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions & Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Quick Actions to Boost Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={suggestion.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate transition-all cursor-pointer"
                  onClick={() => onActionClick?.(suggestion.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      {suggestion.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{suggestion.title}</span>
                        <Badge className={getImpactColor(suggestion.impact)}>
                          {suggestion.impact} impact
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          +{suggestion.points} pts
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{suggestion.timeEstimate}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Achievements
            </CardTitle>
            <Badge variant="secondary">
              {unlockedAchievements.length} / {achievements.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <Card 
                key={achievement.id}
                className={cn(
                  "transition-all duration-300",
                  achievement.unlocked 
                    ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 shadow-md" 
                    : "opacity-60 grayscale hover:opacity-80"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      achievement.unlocked 
                        ? "bg-gradient-to-br from-yellow-400 to-orange-400 text-white shadow-lg" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {achievement.unlocked ? <Trophy className="w-6 h-6" /> : achievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{achievement.title}</span>
                        <Badge className={cn("text-xs", getRarityColor(achievement.rarity))}>
                          {achievement.rarity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {achievement.description}
                      </p>
                      
                      {achievement.maxProgress && (
                        <div className="space-y-1 mb-2">
                          <Progress 
                            value={(achievement.progress || 0) / achievement.maxProgress * 100} 
                            className="h-1"
                          />
                          <div className="text-xs text-muted-foreground">
                            {achievement.progress || 0} / {achievement.maxProgress}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-yellow-600">
                          +{achievement.points} pts
                        </span>
                        {achievement.unlocked && achievement.dateUnlocked && (
                          <span className="text-xs text-muted-foreground">
                            {achievement.dateUnlocked.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}