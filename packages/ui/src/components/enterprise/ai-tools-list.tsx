/**
 * AI Tools List Component
 * 
 * Displays a list of registered AI tools with their metadata.
 * Enterprise-gated component.
 */

import { Card } from '../primitives/card';
import { Badge } from '../primitives/badge';

export interface AiTool {
  name: string;
  version: string;
  description: string;
  deterministic: boolean;
  sideEffect: boolean;
  idempotent: boolean;
  requiredCapabilities: string[];
}

export interface AiToolsListProps {
  tools: AiTool[];
  onToolClick?: (tool: AiTool) => void;
}

/**
 * AI Tools List Component
 * Displays registered AI tools with metadata badges
 */
export function AiToolsList({ tools, onToolClick }: AiToolsListProps) {
  if (tools.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-gray-500 text-center py-4">
          No AI tools registered
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <Card 
          key={`${tool.name}@${tool.version}`} 
          className="p-4 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onToolClick?.(tool)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{tool.name}</h3>
                <Badge variant="outline">{tool.version}</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
              <div className="flex gap-2 mt-2">
                {tool.deterministic && (
                  <Badge variant="success" className="text-xs">Deterministic</Badge>
                )}
                {tool.sideEffect && (
                  <Badge variant="warning" className="text-xs">Side Effect</Badge>
                )}
                {tool.idempotent && (
                  <Badge variant="info" className="text-xs">Idempotent</Badge>
                )}
              </div>
            </div>
          </div>
          {tool.requiredCapabilities.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Capabilities: {tool.requiredCapabilities.join(', ')}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
