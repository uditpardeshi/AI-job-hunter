import { CandidateProfile } from '@ai-job-hunter/shared';

export interface NormalizedSkill {
  raw: string;
  normalized: string;
}

export interface CandidateExtractedSkill {
  skill: string;
  sources: string[];
}

const CANONICAL_SKILL_MAP: Record<string, string> = {
  // Languages & runtimes
  js: 'JavaScript',
  javascript: 'JavaScript',
  ecmascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  python: 'Python',
  python3: 'Python',
  py: 'Python',
  golang: 'Go',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  'c++': 'C++',
  cpp: 'C++',
  'c#': 'C#',
  csharp: 'C#',
  ruby: 'Ruby',
  php: 'PHP',

  // Databases & storage
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  psql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  mongo: 'MongoDB',
  redis: 'Redis',
  elasticsearch: 'Elasticsearch',
  elastic: 'Elasticsearch',
  cassandra: 'Cassandra',
  dynamodb: 'DynamoDB',
  sqlite: 'SQLite',

  // Frontend & frameworks
  react: 'React',
  reactjs: 'React',
  'react.js': 'React',
  next: 'Next.js',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  vue: 'Vue.js',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  angular: 'Angular',
  angularjs: 'Angular',
  svelte: 'Svelte',
  'tailwind css': 'Tailwind CSS',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  html: 'HTML',
  html5: 'HTML',
  css: 'CSS',
  css3: 'CSS',

  // Backend frameworks & protocols
  express: 'Express',
  expressjs: 'Express',
  'express.js': 'Express',
  fastapi: 'FastAPI',
  django: 'Django',
  flask: 'Flask',
  spring: 'Spring Boot',
  'spring boot': 'Spring Boot',
  springboot: 'Spring Boot',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  rest: 'REST APIs',
  restful: 'REST APIs',
  'rest api': 'REST APIs',
  'restful api': 'REST APIs',
  'rest apis': 'REST APIs',
  grpc: 'gRPC',

  // Cloud & DevOps
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  docker: 'Docker',
  containers: 'Docker',
  containerization: 'Docker',
  aws: 'AWS',
  'amazon web services': 'AWS',
  gcp: 'GCP',
  'google cloud': 'GCP',
  'google cloud platform': 'GCP',
  azure: 'Azure',
  'microsoft azure': 'Azure',
  terraform: 'Terraform',
  ansible: 'Ansible',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  'continuous integration': 'CI/CD',
  git: 'Git',
  github: 'GitHub',
  linux: 'Linux',
  kafka: 'Kafka',
  rabbitmq: 'RabbitMQ',

  // AI / Data
  ml: 'Machine Learning',
  'machine learning': 'Machine Learning',
  ai: 'Artificial Intelligence',
  'artificial intelligence': 'Artificial Intelligence',
  nlp: 'NLP',
  'natural language processing': 'NLP',
  pytorch: 'PyTorch',
  tensorflow: 'TensorFlow',
  pandas: 'Pandas',
  numpy: 'NumPy',
};

export class SkillNormalizer {
  /**
   * Normalize a raw skill name into canonical representation.
   */
  public static normalize(rawSkill: string): NormalizedSkill {
    if (!rawSkill || typeof rawSkill !== 'string') {
      return { raw: '', normalized: '' };
    }

    const trimmed = rawSkill.trim();
    const cleanKey = trimmed
      .toLowerCase()
      .replace(/[._\-\s]+/g, ' ')
      .trim();

    // Check direct lowercase match first
    const directKey = trimmed.toLowerCase();
    if (CANONICAL_SKILL_MAP[directKey]) {
      return { raw: trimmed, normalized: CANONICAL_SKILL_MAP[directKey] };
    }

    // Check normalized spaces match
    if (CANONICAL_SKILL_MAP[cleanKey]) {
      return { raw: trimmed, normalized: CANONICAL_SKILL_MAP[cleanKey] };
    }

    // Default: Return trimmed original with initial letter capitalization if not mapped
    const capitalized = trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
    return { raw: trimmed, normalized: capitalized };
  }

  /**
   * Extract and normalize all candidate skills across verified profile sections
   * tracking evidence sources (skills, experience, projects, certifications).
   */
  public static extractCandidateSkills(profile: CandidateProfile): CandidateExtractedSkill[] {
    const skillMap = new Map<string, Set<string>>();

    const addSkill = (raw: string, source: string) => {
      if (!raw || typeof raw !== 'string') return;
      const { normalized } = SkillNormalizer.normalize(raw);
      if (!normalized) return;

      if (!skillMap.has(normalized)) {
        skillMap.set(normalized, new Set());
      }
      skillMap.get(normalized)!.add(source);
    };

    // 1. Direct skills list
    if (Array.isArray(profile.skills)) {
      profile.skills.forEach((s) => addSkill(s, 'skills'));
    }

    // 2. Experience item skills
    if (Array.isArray(profile.experience)) {
      profile.experience.forEach((exp) => {
        if (Array.isArray(exp.skills)) {
          exp.skills.forEach((s) => addSkill(s, 'experience'));
        }
      });
    }

    // 3. Projects technologies
    if (Array.isArray(profile.projects)) {
      profile.projects.forEach((proj) => {
        if (Array.isArray(proj.technologies)) {
          proj.technologies.forEach((s) => addSkill(s, 'projects'));
        }
      });
    }

    // 4. Certifications
    if (Array.isArray(profile.certifications)) {
      profile.certifications.forEach((cert) => {
        if (cert && cert.name) {
          addSkill(cert.name, 'certifications');
          // Extract embedded technology keywords (e.g. "AWS" from "AWS Certified Developer", "Kubernetes" from "CKA Kubernetes")
          const words = cert.name.split(/[\s,/\-_]+/);
          for (const word of words) {
            const lower = word.toLowerCase();
            if (CANONICAL_SKILL_MAP[lower]) {
              addSkill(word, 'certifications');
            }
          }
        }
      });
    }

    const result: CandidateExtractedSkill[] = [];
    for (const [skill, sourcesSet] of skillMap.entries()) {
      result.push({
        skill,
        sources: Array.from(sourcesSet),
      });
    }

    return result;
  }
}
