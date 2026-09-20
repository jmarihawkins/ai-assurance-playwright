export type KnowledgeSource = {
  id: string;
  title: string;
  content: string;
};

const sources: KnowledgeSource[] = [
  {
    id: 'plan-guide-12',
    title: 'Target-Date Fund Guide',
    content:
      'A target-date fund is a diversified investment fund that holds a mix of assets such as stocks and bonds. The investment mix generally becomes more conservative as the target retirement year approaches. The target year is usually based on an approximate retirement date and does not guarantee a specific return or outcome.'
  }
];

export function findKnowledge(question: string): KnowledgeSource[] {
  const normalizedQuestion = question.toLowerCase();

  if (
    normalizedQuestion.includes('target-date') ||
    normalizedQuestion.includes('target date')
  ) {
    return sources.filter(source => source.id === 'plan-guide-12');
  }

  return [];
}