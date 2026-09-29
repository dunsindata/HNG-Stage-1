interface WelcomeBarProps {
  firstName: string;
  team: { name: string; initials: string }[];
  onInvite: () => void;
}

export function WelcomeBar({ firstName, team, onInvite }: WelcomeBarProps) {
  return (
    <section className="welcome">
      <h1 className="welcome__title">
        Welcome back, {firstName} <span aria-hidden="true">👋</span>
      </h1>

      <div className="welcome__right">
        <ul className="avatar-stack" aria-label="Team members">
          {team.map((member) => (
            <li key={member.name} className="avatar-stack__item" title={member.name}>
              {member.initials}
            </li>
          ))}
        </ul>
        <button type="button" className="button--outline" onClick={onInvite}>
          Invite
        </button>
      </div>
    </section>
  );
}
