import {
  query,
  update,
  text,
  Record,
  StableBTreeMap,
  Variant,
  Vec,
  Ok,
  Err,
  ic,
  Opt,
  None,
  Some,
  Principal,
  nat64,
  Null,
  Result,
  Canister,
} from "azle";
// @ts-ignore
import { v4 as uuidv4 } from "uuid";

// User Role Types
const UserRole = Variant({
  StudentAthlete: Null,
  Coach: Null,
  Administrator: Null,
  LeagueOfficial: Null,
});

// Payload for registering users
const UserPayload = Record({
  name: text,
  email: text,
  role: UserRole,
});

// Payload for updating users
const UpdateUserPayload = Record({
  id: text,
  name: text,
  email: text,
  role: UserRole,
});

// User Record
const User = Record({
  id: text,
  principal: Principal,
  name: text,
  email: text,
  role: UserRole,
});

// Sport and Tournament Structures
const SportType = Variant({
  Football: Null,
  Basketball: Null,
  Volleyball: Null,
});

const TournamentStructure = Variant({
  RoundRobin: Null,
  Knockout: Null,
});

// Team Payload and Record
const TeamPayload = Record({
  name: text,
  coachId: text,
  sportType: SportType,
  playerIds: Vec(Principal),
});

const Team = Record({
  id: text,
  name: text,
  coach: Principal,
  players: Vec(Principal),
  sportType: SportType,
});

// Match Payload and Record
const MatchPayload = Record({
  homeTeamId: text,
  awayTeamId: text,
  scheduledDate: text,
});

const MatchResultPayload = Record({
  matchId: text,
  result: text,
});

const Match = Record({
  id: text,
  homeTeam: Team,
  awayTeam: Team,
  sportType: SportType,
  scheduledDate: text,
  result: Opt(text),
});

// Tournament Payload and Record
const TournamentPayload = Record({
  name: text,
  structure: TournamentStructure,
  teamIds: Vec(text),
  sportType: SportType,
});

const Tournament = Record({
  id: text,
  name: text,
  structure: TournamentStructure,
  teams: Vec(text),
  sportType: SportType,
});

// League Payload and Record
const LeaguePayload = Record({
  name: text,
  sportType: SportType,
});

const League = Record({
  id: text,
  name: text,
  tournaments: Vec(Tournament),
  sportType: SportType,
  createdBy: Principal,
});

// Error Handling
const ErrorType = Variant({
  NotFound: text,
  InvalidPayload: text,
});

// Storage Maps
const usersStorage = StableBTreeMap(0, text, User);
const leaguesStorage = StableBTreeMap(1, text, League);
const tournamentsStorage = StableBTreeMap(2, text, Tournament);
const matchesStorage = StableBTreeMap(3, text, Match);
const teamsStorage = StableBTreeMap(4, text, Team);

// Helper function to generate a unique ID
function generateId(): text {
  return uuidv4();
}

// Canister Module
export default Canister({
  // User Registration
  registerUser: update([UserPayload], Result(User, ErrorType), (payload) => {
    const id = generateId();
    const user = {
      id: id,
      principal: ic.caller(),
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
    usersStorage.insert(id, user);
    return Ok(user);
  }),

  // Update user info
  updateUser: update([UpdateUserPayload], Result(User, ErrorType), (payload) => {
    const userOpt = usersStorage.get(payload.id);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with id ${payload.id} not found.` });
    }
    const user = {
      ...userOpt.Some,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
    usersStorage.insert(payload.id, user);
    return Ok(user);
  }),

  // Get all users
  getUsers: query([], Vec(User), () => {
    return usersStorage.values();
  }),

  // Create League
  createLeague: update([LeaguePayload], Result(League, ErrorType), (payload) => {
    const id = generateId();
    const league = {
      id: id,
      name: payload.name,
      sportType: payload.sportType,
      tournaments: [],
      createdBy: ic.caller(),
    };
    leaguesStorage.insert(id, league);
    return Ok(league);
  }),

  // Get all leagues
  getLeagues: query([], Vec(League), () => {
    return leaguesStorage.values();
  }),

  // Create Tournament
  createTournament: update([TournamentPayload], Result(Tournament, ErrorType), (payload) => {
    const id = generateId();
    const tournament = {
      id: id,
      name: payload.name,
      structure: payload.structure,
      teams: payload.teamIds,
      sportType: payload.sportType,
    };
    tournamentsStorage.insert(id, tournament);
    return Ok(tournament);
  }),

  // Get all tournaments
  getTournaments: query([], Vec(Tournament), () => {
    return tournamentsStorage.values();
  }),

  // Create Team
  createTeam: update([TeamPayload], Result(Team, ErrorType), (payload) => {
    const id = generateId();
    const team = {
      id: id,
      name: payload.name,
      coach: ic.caller(),
      players: payload.playerIds,
      sportType: payload.sportType,
    };
    teamsStorage.insert(id, team);
    return Ok(team);
  }),

  // Get all teams
  getTeams: query([], Vec(Team), () => {
    return teamsStorage.values();
  }),

  // Schedule Match
  scheduleMatch: update([MatchPayload], Result(Match, ErrorType), (payload) => {
    const homeTeamOpt = teamsStorage.get(payload.homeTeamId);
    const awayTeamOpt = teamsStorage.get(payload.awayTeamId);

    if ("None" in homeTeamOpt || "None" in awayTeamOpt) {
      return Err({ NotFound: "One of the teams was not found." });
    }

    const id = generateId();
    const match = {
      id: id,
      homeTeam: homeTeamOpt.Some,
      awayTeam: awayTeamOpt.Some,
      sportType: homeTeamOpt.Some.sportType,
      scheduledDate: payload.scheduledDate,
      result: None,
    };

    matchesStorage.insert(id, match);
    return Ok(match);
  }),

    // Get all matches
    getMatches: query([], Vec(Match), () => {
      return matchesStorage.values();
    }),
  
    // Submit Match Result
    submitMatchResult: update([MatchResultPayload], Result(Match, ErrorType), (payload) => {
      const matchOpt = matchesStorage.get(payload.matchId);
  
      if ("None" in matchOpt) {
        return Err({ NotFound: `Match with id ${payload.matchId} not found.` });
      }
  
      const match = matchOpt.Some;
      const updatedMatch = {
        ...match,
        result: Some(payload.result),
      };
  
      matchesStorage.insert(match.id, updatedMatch);
      return Ok(updatedMatch);
    }),
  
    // Leaderboards - Aggregate points for teams based on match results
    getLeaderboards: query([SportType], Vec(Team), (sportType) => {
      const teams = teamsStorage.values().filter((team) => team.sportType === sportType);
      const teamResults = new Map();
  
      matchesStorage.values().forEach((match) => {
        if ("Some" in match.result) {
          const result = match.result.Some;
  
          if (result === match.homeTeam.id) {
            teamResults.set(match.homeTeam.id, (teamResults.get(match.homeTeam.id) || 0) + 3); // Home team wins
          } else if (result === match.awayTeam.id) {
            teamResults.set(match.awayTeam.id, (teamResults.get(match.awayTeam.id) || 0) + 3); // Away team wins
          }
        }
      });
  
      // Sort teams by their points in descending order
      return teams.sort((a, b) => (teamResults.get(b.id) || 0) - (teamResults.get(a.id) || 0));
    }),
  });

  
