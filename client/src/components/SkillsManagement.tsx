import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Star, 
  Loader2,
  X,
  CheckCircle2,
  TrendingUp,
  Filter
} from "lucide-react";
import { type Skill, type UserSkill } from "@shared/schema";
import { z } from "zod";

// Skill form validation schema
const skillFormSchema = z.object({
  skillId: z.number().min(1, "Please select a skill"),
  level: z.enum(["beginner", "intermediate", "expert"], {
    required_error: "Please select a proficiency level"
  }),
  yearsExperience: z.number().min(0, "Experience must be 0 or more years").max(50, "Experience cannot exceed 50 years")
});

type SkillFormData = z.infer<typeof skillFormSchema>;

// Extended UserSkill with skill details
interface UserSkillWithDetails extends UserSkill {
  skill: {
    name: string;
    category: string;
  } | null;
}

interface SkillsManagementProps {
  className?: string;
}

const PROFICIENCY_LEVELS = [
  { value: "beginner", label: "Beginner", description: "Learning the basics", color: "bg-orange-500" },
  { value: "intermediate", label: "Intermediate", description: "Comfortable with the skill", color: "bg-blue-500" },
  { value: "expert", label: "Expert", description: "Highly experienced", color: "bg-green-500" }
];

const SKILL_CATEGORIES = ["All", "Technical", "Creative", "Administrative", "Specialized"];

export default function SkillsManagement({ className }: SkillsManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Component state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<UserSkillWithDetails | null>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [skillFormData, setSkillFormData] = useState<SkillFormData>({
    skillId: 0,
    level: "intermediate",
    yearsExperience: 1
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch user skills with names
  const { data: userSkills = [], isLoading: userSkillsLoading, error: userSkillsError } = useQuery<UserSkillWithDetails[]>({
    queryKey: ['/api/users', user?.id, 'skills'],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/users/${user.id}/skills?includeNames=true`);
      if (!response.ok) throw new Error('Failed to fetch user skills');
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch available skills for search
  const { data: availableSkills = [], isLoading: skillsLoading } = useQuery<Skill[]>({
    queryKey: ['/api/skills', selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") {
        params.set('category', selectedCategory);
      }
      const response = await fetch(`/api/skills?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch skills');
      return response.json();
    }
  });

  // Search skills when user types
  const { data: searchResults = [], isLoading: searchLoading } = useQuery<Skill[]>({
    queryKey: ['/api/skills/search', skillSearch],
    queryFn: async () => {
      if (!skillSearch.trim()) return [];
      const response = await fetch(`/api/skills/search?q=${encodeURIComponent(skillSearch)}`);
      if (!response.ok) throw new Error('Failed to search skills');
      return response.json();
    },
    enabled: skillSearch.trim().length > 1
  });

  // Add skill mutation
  const addSkillMutation = useMutation({
    mutationFn: async (data: SkillFormData) => {
      if (!user?.id) throw new Error('User not authenticated');
      return apiRequest('POST', `/api/users/${user.id}/skills`, {
        skillId: data.skillId,
        level: data.level,
        yearsExperience: data.yearsExperience
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'skills'] });
      toast({
        title: "Skill added successfully",
        description: "Your skill has been added to your profile."
      });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add skill",
        description: error.message || "There was an error adding your skill. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Edit skill mutation
  const editSkillMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<SkillFormData> }) => {
      return apiRequest('PATCH', `/api/user-skills/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'skills'] });
      toast({
        title: "Skill updated successfully",
        description: "Your skill has been updated."
      });
      setIsEditDialogOpen(false);
      setEditingSkill(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update skill",
        description: error.message || "There was an error updating your skill. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete skill mutation
  const deleteSkillMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/user-skills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'skills'] });
      toast({
        title: "Skill removed successfully",
        description: "The skill has been removed from your profile."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove skill",
        description: error.message || "There was an error removing your skill. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Filter skills for selection (exclude already added skills)
  const getSelectableSkills = () => {
    const userSkillIds = userSkills.map(us => us.skillId);
    const skills = skillSearch.trim() ? searchResults : availableSkills;
    return skills.filter(skill => !userSkillIds.includes(skill.id));
  };

  // Reset form data
  const resetForm = () => {
    setSkillFormData({
      skillId: 0,
      level: "intermediate",
      yearsExperience: 1
    });
    setFormErrors({});
    setSkillSearch("");
  };

  // Validate form
  const validateForm = (data: SkillFormData): boolean => {
    try {
      skillFormSchema.parse(data);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path.length > 0) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  // Handle adding skill
  const handleAddSkill = () => {
    if (validateForm(skillFormData)) {
      addSkillMutation.mutate(skillFormData);
    }
  };

  // Handle editing skill
  const handleEditSkill = () => {
    if (!editingSkill) return;
    
    const editData = {
      level: skillFormData.level,
      yearsExperience: skillFormData.yearsExperience
    };
    
    if (validateForm({ ...skillFormData, skillId: editingSkill.skillId })) {
      editSkillMutation.mutate({ id: editingSkill.id, data: editData });
    }
  };

  // Open edit dialog
  const openEditDialog = (userSkill: UserSkillWithDetails) => {
    setEditingSkill(userSkill);
    setSkillFormData({
      skillId: userSkill.skillId,
      level: userSkill.level as "beginner" | "intermediate" | "expert",
      yearsExperience: userSkill.yearsExperience || 1
    });
    setIsEditDialogOpen(true);
  };

  // Handle delete skill
  const handleDeleteSkill = (id: number) => {
    deleteSkillMutation.mutate(id);
  };

  // Get proficiency level display info
  const getProficiencyInfo = (level: string) => {
    return PROFICIENCY_LEVELS.find(l => l.value === level) || PROFICIENCY_LEVELS[1];
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Skills & Expertise
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Showcase your skills and proficiency levels to attract better opportunities
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-skill">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Skill
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Skill</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Category Filter */}
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger data-testid="select-skill-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {SKILL_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Skill Search */}
                  <div className="space-y-2">
                    <Label>Search Skills</Label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        placeholder="Search for skills..."
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        className="pl-10"
                        data-testid="input-skill-search"
                      />
                      {searchLoading && (
                        <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Skill Selection */}
                  <div className="space-y-2">
                    <Label>Select Skill {formErrors.skillId && <span className="text-destructive text-sm">- {formErrors.skillId}</span>}</Label>
                    <Select 
                      value={skillFormData.skillId.toString()} 
                      onValueChange={(value) => setSkillFormData({...skillFormData, skillId: parseInt(value)})}
                    >
                      <SelectTrigger data-testid="select-skill" className={formErrors.skillId ? "border-destructive" : ""}>
                        <SelectValue placeholder="Choose a skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSelectableSkills().map(skill => (
                          <SelectItem key={skill.id} value={skill.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{skill.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {skill.category}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                        {getSelectableSkills().length === 0 && (
                          <SelectItem value="" disabled>
                            {skillsLoading ? "Loading..." : "No available skills"}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Proficiency Level */}
                  <div className="space-y-2">
                    <Label>Proficiency Level {formErrors.level && <span className="text-destructive text-sm">- {formErrors.level}</span>}</Label>
                    <Select 
                      value={skillFormData.level} 
                      onValueChange={(value) => setSkillFormData({...skillFormData, level: value as any})}
                    >
                      <SelectTrigger data-testid="select-proficiency" className={formErrors.level ? "border-destructive" : ""}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFICIENCY_LEVELS.map(level => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${level.color}`} />
                              <div>
                                <div className="font-medium">{level.label}</div>
                                <div className="text-xs text-muted-foreground">{level.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Years of Experience */}
                  <div className="space-y-2">
                    <Label>Years of Experience {formErrors.yearsExperience && <span className="text-destructive text-sm">- {formErrors.yearsExperience}</span>}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={skillFormData.yearsExperience}
                      onChange={(e) => setSkillFormData({...skillFormData, yearsExperience: parseInt(e.target.value) || 0})}
                      className={formErrors.yearsExperience ? "border-destructive" : ""}
                      data-testid="input-years-experience"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={handleAddSkill}
                      disabled={addSkillMutation.isPending}
                      className="flex-1"
                      data-testid="button-submit-add-skill"
                    >
                      {addSkillMutation.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Add Skill
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAddDialogOpen(false)}
                      data-testid="button-cancel-add-skill"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {userSkillsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading your skills...</span>
            </div>
          ) : userSkillsError ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">Failed to load skills</p>
              <Button 
                variant="outline" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'skills'] })}
                data-testid="button-retry-skills"
              >
                Try Again
              </Button>
            </div>
          ) : userSkills.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No skills added yet</h3>
              <p className="text-muted-foreground mb-4">
                Start building your profile by adding your skills and expertise
              </p>
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                data-testid="button-add-first-skill"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Skill
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {userSkills.length} skill{userSkills.length !== 1 ? 's' : ''} in your profile
                </p>
              </div>
              
              <div className="grid gap-3">
                {userSkills.map((userSkill) => {
                  const proficiencyInfo = getProficiencyInfo(userSkill.level);
                  return (
                    <div
                      key={userSkill.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`skill-item-${userSkill.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${proficiencyInfo.color}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{userSkill.skill?.name || 'Unknown Skill'}</span>
                            <Badge variant="outline" className="text-xs">
                              {userSkill.skill?.category || 'Unknown'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {proficiencyInfo.label} • {userSkill.yearsExperience || 0} year{(userSkill.yearsExperience || 0) !== 1 ? 's' : ''} experience
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(userSkill)}
                          data-testid={`button-edit-skill-${userSkill.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-delete-skill-${userSkill.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Skill</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{userSkill.skill?.name}" from your profile? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-delete-skill">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSkill(userSkill.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid="button-confirm-delete-skill"
                              >
                                Remove Skill
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Skill Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Skill</DialogTitle>
          </DialogHeader>
          {editingSkill && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{editingSkill.skill?.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {editingSkill.skill?.category}
                  </Badge>
                </div>
              </div>

              {/* Proficiency Level */}
              <div className="space-y-2">
                <Label>Proficiency Level</Label>
                <Select 
                  value={skillFormData.level} 
                  onValueChange={(value) => setSkillFormData({...skillFormData, level: value as any})}
                >
                  <SelectTrigger data-testid="select-edit-proficiency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFICIENCY_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${level.color}`} />
                          <div>
                            <div className="font-medium">{level.label}</div>
                            <div className="text-xs text-muted-foreground">{level.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Years of Experience */}
              <div className="space-y-2">
                <Label>Years of Experience</Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={skillFormData.yearsExperience}
                  onChange={(e) => setSkillFormData({...skillFormData, yearsExperience: parseInt(e.target.value) || 0})}
                  data-testid="input-edit-years-experience"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleEditSkill}
                  disabled={editSkillMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-edit-skill"
                >
                  {editSkillMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Update Skill
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit-skill"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}