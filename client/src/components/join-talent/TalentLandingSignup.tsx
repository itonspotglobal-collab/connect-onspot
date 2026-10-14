import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Check } from "lucide-react";
import { useSignupModal } from "@/components/SignupModalProvider";
import { TALENT_LANDING_SKILLS, talentLandingReturnTo, talentLandingSkill } from "@/lib/talentLandingSkills";

type Field = "firstName" | "lastName" | "email" | "skill";

export function TalentLandingSignup() {
  const openSignup = useSignupModal();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [handoffError, setHandoffError] = useState("");
  const clearError = (name: Field) => setErrors(current => ({ ...current, [name]: undefined }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Read real controls so native mobile autofill cannot leave stale names.
    const firstName = String(data.get("firstName") ?? "").trim();
    const lastName = String(data.get("lastName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const skill = String(data.get("skill") ?? "");
    const next: Partial<Record<Field, string>> = {};
    if (!firstName || firstName.length > 120) next.firstName = "Enter your first name (up to 120 characters).";
    if (!lastName || lastName.length > 120) next.lastName = "Enter your last name (up to 120 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) next.email = "Enter a valid email, like you@email.com.";
    if (!talentLandingSkill(skill)) next.skill = "Choose the skill closest to your work.";
    setErrors(next);
    setHandoffError("");
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    try {
      openSignup({
        portal: "talent",
        initialTalentProfile: { firstName, lastName, email },
        search: new URLSearchParams({ returnTo: talentLandingReturnTo(skill) }).toString(),
        trigger: event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]') ?? undefined,
      });
    } catch {
      setHandoffError("We couldn’t open signup. Your details are still here. Please try again.");
    }
  }

  function field(name: Field, label: string, id: string, placeholder: string, autoComplete: string, type = "text") {
    return <div className={`field${name === "email" ? " full" : ""}`} data-invalid={errors[name] ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type={type} autoComplete={autoComplete} placeholder={placeholder}
        required maxLength={name === "email" ? 254 : 120}
        aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${id}-error` : undefined}
        onInput={() => clearError(name)} />
      {errors[name] && <span className="err" id={`${id}-error`}>{errors[name]}</span>}
    </div>;
  }

  return <div className="signup talent-signup" id="signup">
    <form noValidate onSubmit={submit} aria-label="Start your talent profile">
      <h2 className="signup-title">Create your free talent profile</h2>
      <p className="signup-note" id="talent-signup-next">Next, choose a password and verify your email to finish creating your account.</p>
      <div className="fields">
        {field("firstName", "First name", "talent-first-name", "Maria", "given-name")}
        {field("lastName", "Last name", "talent-last-name", "Santos", "family-name")}
        {field("email", "Email", "talent-email", "you@email.com", "email", "email")}
        <div className="field full" data-invalid={errors.skill ? "" : undefined}>
          <label htmlFor="talent-main-skill">What kind of work do you do?</label>
          <select id="talent-main-skill" name="skill" required defaultValue="" onChange={() => clearError("skill")}
            aria-invalid={Boolean(errors.skill)} aria-describedby={errors.skill ? "talent-skill-error" : undefined}>
            <option value="">Choose your main skill</option>
            {TALENT_LANDING_SKILLS.map(skill => <option key={skill}>{skill}</option>)}
          </select>
          {errors.skill && <span className="err" id="talent-skill-error">{errors.skill}</span>}
        </div>
      </div>
      {Object.keys(errors).some(key => errors[key as Field]) && <p className="signup-error" role="alert">Please check the highlighted fields.</p>}
      {handoffError && <p className="signup-error" role="alert">{handoffError}</p>}
      <button className="btn" type="submit" aria-describedby="talent-signup-next">Create my free profile</button>
      <div className="reassure">
        {["Free to join", "You set your rate", "Nothing taken from your pay"].map(text => <span key={text}><Check aria-hidden="true" />{text}</span>)}
      </div>
      <p className="legal">By creating a profile you agree to OnSpot’s <Link href="/terms-and-conditions">Terms</Link> and <Link href="/privacy-policy">Privacy Policy</Link>.</p>
    </form>
  </div>;
}

export default TalentLandingSignup;
