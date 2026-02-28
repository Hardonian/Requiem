/**
 * AI Skills List Component
 * 
 * Displays a list of registered AI skills with their metadata.
 * Enterprise-gated component.
 */

import { Card } from '../primitives/card';
import { Badge } from '../primitives/badge';

export interface AiSkill {
  name: string;
  version: string;
  description: string;
  stepCount: number;
}

export interface AiSkillsListProps {
  skills: AiSkill[];
  onSkillClick?: (skill: AiSkill) => void;
  onSkillRun?: (skill: AiSkill) => void;
}

/**
 * AI Skills List Component
 * Displays registered AI skills with step counts
 */
export function AiSkillsList({ skills, onSkillClick, onSkillRun }: AiSkillsListProps) {
  if (skills.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-gray-500 text-center py-4">
          No AI skills registered
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <Card 
          key={`${skill.name}@${skill.version}`} 
          className="p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => onSkillClick?.(skill)}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                <Badge variant="outline">{skill.version}</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">{skill.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="info" className="text-xs">
                  {skill.stepCount} step{skill.stepCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
            {onSkillRun && (
              <button
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkillRun(skill);
                }}
              >
                Run
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
