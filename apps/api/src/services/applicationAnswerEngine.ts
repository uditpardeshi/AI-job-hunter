import { ApplicationQuestion, AnswerSource } from '@ai-job-hunter/shared';
import { logger } from '../utils/logger';

export interface CandidateProfileData {
  id?: string;
  basics?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    currentTitle?: string;
    yearsOfExperience?: number;
  };
  summary?: string;
  skills?: string[] | { name: string; category?: string; yearsOfExperience?: number }[];
  experience?: Array<{
    title?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    description?: string;
  }>;
  education?: Array<{
    degree?: string;
    field?: string;
    institution?: string;
    graduationYear?: number | string;
  }>;
  preferences?: {
    roles?: string[];
    locations?: string[];
    remotePreference?: string;
    minSalary?: number;
    targetSalary?: number;
    currency?: string;
    sponsorshipRequired?: boolean;
    authorizedInCountries?: string[];
  };
}

export interface QuestionSpec {
  question: string;
  questionType?: 'text' | 'number' | 'boolean' | 'choice' | 'sensitive';
  options?: string[];
}

export class ApplicationAnswerEngine {
  /**
   * Identifies if a question touches sensitive, demographic, or legal topics.
   * NEVER guess or fabricate answers for these questions.
   */
  public static isSensitiveQuestion(question: string): boolean {
    const q = question.toLowerCase();
    const sensitivePatterns = [
      /\bvisa\b/,
      /\bsponsorship\b/,
      /\bauthorized to work\b/,
      /\blegally authorized\b/,
      /\bwork authorization\b/,
      /\bcitizenship\b/,
      /\bgender\b/,
      /\brace\b/,
      /\bethnicity\b/,
      /\bdisability\b/,
      /\bveteran\b/,
      /\bsexual orientation\b/,
      /\bsalary\b/,
      /\bcompensation\b/,
      /\bexpected salary\b/,
      /\bdesired salary\b/,
      /\bcurrent salary\b/,
      /\bcriminal\b/,
      /\bbackground check\b/,
      /\bdrug test\b/,
    ];
    return sensitivePatterns.some((pattern) => pattern.test(q));
  }

  /**
   * Determine question type from text if not provided
   */
  public static inferQuestionType(question: string, options?: string[]): 'text' | 'number' | 'boolean' | 'choice' | 'sensitive' {
    if (this.isSensitiveQuestion(question)) {
      return 'sensitive';
    }
    if (options && options.length > 0) {
      return 'choice';
    }
    const q = question.toLowerCase();
    if (q.startsWith('how many years') || q.includes('years of experience') || q.includes('how many')) {
      return 'number';
    }
    if (
      q.startsWith('do you') ||
      q.startsWith('are you') ||
      q.startsWith('have you') ||
      q.startsWith('will you') ||
      q.startsWith('can you')
    ) {
      return 'boolean';
    }
    return 'text';
  }

  /**
   * Attempt to answer a single question based on candidate profile.
   */
  public static answerQuestion(
    questionSpec: QuestionSpec,
    profile?: CandidateProfileData | null
  ): Omit<ApplicationQuestion, 'id' | 'applicationPreparationId' | 'createdAt' | 'updatedAt'> {
    const questionText = questionSpec.question;
    const isSensitive = this.isSensitiveQuestion(questionText);
    const questionType = questionSpec.questionType || this.inferQuestionType(questionText, questionSpec.options);
    const options = questionSpec.options || [];

    const q = questionText.toLowerCase();

    // Default fallback: requires user input
    let answer: string | null = null;
    let answerSource: AnswerSource = 'USER_INPUT';
    let confidence = 0.0;
    let requiresUserInput = true;

    // Rule 1: SENSITIVE QUESTIONS MUST REQUIRE USER INPUT
    if (isSensitive) {
      // Check if user has explicit preference recorded (e.g. sponsorship)
      if (q.includes('sponsorship') && profile?.preferences?.sponsorshipRequired !== undefined) {
        answer = profile.preferences.sponsorshipRequired ? 'Yes' : 'No';
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.9;
        // Still require user input/confirmation for safety
        requiresUserInput = true;
      } else if (
        (q.includes('authorized') || q.includes('legally')) &&
        profile?.preferences?.authorizedInCountries &&
        profile.preferences.authorizedInCountries.length > 0
      ) {
        answer = `Yes, authorized in ${profile.preferences.authorizedInCountries.join(', ')}`;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.85;
        requiresUserInput = true;
      } else if (q.includes('salary') && (profile?.preferences?.targetSalary || profile?.preferences?.minSalary)) {
        const val = profile.preferences.targetSalary || profile.preferences.minSalary;
        const cur = profile.preferences.currency || 'USD';
        answer = `${val} ${cur}`;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.8;
        requiresUserInput = true;
      }

      return {
        question: questionText,
        questionType: 'sensitive',
        candidateAnswer: answer,
        answerSource,
        confidence,
        requiresUserInput: true, // Always require review/confirmation for sensitive
        isSensitive: true,
        options,
      };
    }

    if (!profile) {
      return {
        question: questionText,
        questionType,
        candidateAnswer: null,
        answerSource: 'USER_INPUT',
        confidence: 0,
        requiresUserInput: true,
        isSensitive: false,
        options,
      };
    }

    const basics = profile.basics || {};

    // Basic Profile Fields
    if (q.includes('full name') || q === 'name') {
      if (basics.name) {
        answer = basics.name;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('first name')) {
      if (basics.name) {
        answer = basics.name.split(' ')[0] || '';
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('last name')) {
      if (basics.name) {
        const parts = basics.name.split(' ');
        answer = parts.length > 1 ? parts.slice(1).join(' ') : '';
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('email')) {
      if (basics.email) {
        answer = basics.email;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('phone') || q.includes('mobile') || q.includes('contact number')) {
      if (basics.phone) {
        answer = basics.phone;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('linkedin')) {
      if (basics.linkedin) {
        answer = basics.linkedin;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('github')) {
      if (basics.github) {
        answer = basics.github;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('portfolio') || q.includes('website') || q.includes('personal site')) {
      if (basics.portfolio) {
        answer = basics.portfolio;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 1.0;
        requiresUserInput = false;
      }
    } else if (q.includes('location') || q.includes('city') || q.includes('where are you based')) {
      if (basics.location) {
        answer = basics.location;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.95;
        requiresUserInput = false;
      }
    } else if (q.includes('years of experience') || q.includes('total experience')) {
      if (basics.yearsOfExperience !== undefined) {
        answer = String(basics.yearsOfExperience);
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.95;
        requiresUserInput = false;
      } else if (profile.experience && profile.experience.length > 0) {
        // Approximate from experience count if not specified
        answer = `${profile.experience.length * 2}`;
        answerSource = 'GENERATED';
        confidence = 0.7;
        requiresUserInput = true;
      }
    } else if (q.includes('current title') || q.includes('current role')) {
      if (basics.currentTitle) {
        answer = basics.currentTitle;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.95;
        requiresUserInput = false;
      } else if (profile.experience && profile.experience[0]?.title) {
        answer = profile.experience[0].title;
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.85;
        requiresUserInput = false;
      }
    } else if (q.includes('highest level of education') || q.includes('degree')) {
      if (profile.education && profile.education.length > 0) {
        const edu = profile.education[0];
        answer = [edu.degree, edu.field, edu.institution].filter(Boolean).join(' in ');
        answerSource = 'CANDIDATE_PROFILE';
        confidence = 0.9;
        requiresUserInput = false;
      }
    } else {
      // Check skills match in question
      const skillsList: string[] = Array.isArray(profile.skills)
        ? profile.skills.map((s) => (typeof s === 'string' ? s : s.name))
        : [];

      for (const skill of skillsList) {
        if (q.includes(skill.toLowerCase())) {
          if (questionType === 'boolean') {
            answer = 'Yes';
            answerSource = 'CANDIDATE_PROFILE';
            confidence = 0.9;
            requiresUserInput = false;
          } else if (questionType === 'number') {
            // Find years of experience for that skill if available
            const expYears = (typeof profile.skills?.[0] === 'object' && 'yearsOfExperience' in (profile.skills[0] || {}))
              ? (profile.skills as any[]).find((s) => s.name.toLowerCase() === skill.toLowerCase())?.yearsOfExperience || basics.yearsOfExperience || 3
              : basics.yearsOfExperience || 3;
            answer = String(expYears);
            answerSource = 'CANDIDATE_PROFILE';
            confidence = 0.85;
            requiresUserInput = false;
          } else {
            answer = `I have extensive experience working with ${skill} across multiple production projects.`;
            answerSource = 'GENERATED';
            confidence = 0.8;
            requiresUserInput = true;
          }
          break;
        }
      }
    }

    return {
      question: questionText,
      questionType,
      candidateAnswer: answer,
      answerSource,
      confidence,
      requiresUserInput,
      isSensitive: false,
      options,
    };
  }

  /**
   * Process a batch of questions for an application preparation
   */
  public static prepareQuestions(
    questions: QuestionSpec[],
    profile?: CandidateProfileData | null
  ): {
    questions: Omit<ApplicationQuestion, 'id' | 'applicationPreparationId' | 'createdAt' | 'updatedAt'>[];
    preparedAnswers: Record<string, any>;
    missingAnswers: string[];
    warnings: string[];
  } {
    const preparedAnswers: Record<string, any> = {};
    const missingAnswers: string[] = [];
    const warnings: string[] = [];

    const processedQuestions = questions.map((spec) => {
      const qResult = this.answerQuestion(spec, profile);
      if (qResult.candidateAnswer) {
        preparedAnswers[spec.question] = qResult.candidateAnswer;
      } else {
        missingAnswers.push(spec.question);
      }

      if (qResult.isSensitive) {
        warnings.push(`Sensitive question requires explicit user verification: "${spec.question}"`);
      } else if (qResult.requiresUserInput) {
        warnings.push(`User input needed for question: "${spec.question}"`);
      }

      return qResult;
    });

    return {
      questions: processedQuestions,
      preparedAnswers,
      missingAnswers,
      warnings,
    };
  }
}
