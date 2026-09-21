import { CandidateProfile, RemoteType } from '@ai-job-hunter/shared';

export interface LocationMatchResult {
  locationScore: number; // 0 - 100
  explanation: string;
}

export class LocationMatcher {
  public static matchLocation(
    profile: CandidateProfile,
    jobLocation: string | null,
    jobRemoteType: RemoteType
  ): LocationMatchResult {
    const prefs = profile.preferences || {
      preferredLocations: [],
      remotePreference: 'any',
    };

    const candRemotePref = (prefs.remotePreference || 'any').toLowerCase();
    const candLocations = (prefs.preferredLocations || []).map((l) => l.toLowerCase().trim());
    const jobLoc = (jobLocation || '').toLowerCase().trim();

    // 1. If candidate has no remote preference or accepts 'any'
    if (candRemotePref === 'any' || !candRemotePref) {
      return {
        locationScore: 100,
        explanation: 'Candidate open to any work arrangement / location.',
      };
    }

    // 2. Both agree on Remote
    if (jobRemoteType === 'remote') {
      if (candRemotePref === 'remote' || candRemotePref === 'hybrid') {
        return {
          locationScore: 100,
          explanation: 'Job is fully remote, matching candidate preference.',
        };
      }
      return {
        locationScore: 85,
        explanation: 'Job is remote; candidate preferred onsite/hybrid.',
      };
    }

    // 3. Check city/geographic alignment
    let cityMatched = false;
    if (candLocations.length > 0 && jobLoc) {
      cityMatched = candLocations.some(
        (loc) => jobLoc.includes(loc) || loc.includes(jobLoc)
      );
    }

    // 4. Candidate wants remote only, but job is hybrid or onsite
    if (candRemotePref === 'remote') {
      if (jobRemoteType === 'hybrid') {
        const score = cityMatched ? 60 : 35;
        return {
          locationScore: score,
          explanation: cityMatched
            ? 'Job is hybrid in candidate preferred location, but candidate preferred full remote.'
            : 'Job is hybrid outside preferred location while candidate preferred full remote.',
        };
      }
      if (jobRemoteType === 'onsite') {
        const score = cityMatched ? 45 : 20;
        return {
          locationScore: score,
          explanation: cityMatched
            ? 'Job is onsite in candidate preferred city, but candidate preferred full remote.'
            : 'Job is onsite in another location while candidate preferred full remote.',
        };
      }
    }

    // 5. Candidate prefers hybrid
    if (candRemotePref === 'hybrid') {
      if (jobRemoteType === 'hybrid') {
        const score = cityMatched || candLocations.length === 0 ? 100 : 70;
        return {
          locationScore: score,
          explanation: cityMatched
            ? 'Job matches candidate hybrid arrangement and preferred location.'
            : 'Job is hybrid arrangement.',
        };
      }
      if (jobRemoteType === 'onsite') {
        const score = cityMatched ? 75 : 50;
        return {
          locationScore: score,
          explanation: 'Job is onsite; candidate prefers hybrid.',
        };
      }
    }

    // 6. Candidate prefers onsite
    if (candRemotePref === 'onsite') {
      if (jobRemoteType === 'onsite') {
        const score = cityMatched || candLocations.length === 0 ? 100 : 65;
        return {
          locationScore: score,
          explanation: cityMatched
            ? 'Job matches candidate onsite preference and preferred city.'
            : 'Job is onsite arrangement.',
        };
      }
    }

    // Default neutral fallback
    const score = cityMatched ? 90 : 75;
    return {
      locationScore: score,
      explanation: 'General location alignment evaluated.',
    };
  }
}
