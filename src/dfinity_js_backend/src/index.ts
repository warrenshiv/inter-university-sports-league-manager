import {
  query,
  update,
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
  text,
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

// User Record
const User = Record({
  id: text,
  principal: Principal,
  name: text,
  email: text,
  role: UserRole,
});

// Tournament and League Types
const SportType = Variant({
  Football: Null,
  Basketball: Null,
  Volleyball: Null,
});

const TournamentStructure = Variant({
  RoundRobin: Null,
  Knockout: Null,
});

const Team = Record({
  id: text,
  name: text,
  coach: Principal,
  players: Vec(Principal),
  sportType: SportType,
});

const Match = Record({
  id: text,
  homeTeam: Team,
  awayTeam: Team,
  sportType: SportType,
  scheduledDate: text,
  result: Opt(text),
});

const Tournament = Record({
  id: text,
  name: text,
  structure: TournamentStructure,
  teams: Vec(text),
  sportType: SportType,
});

const League = Record({
  id: text,
  name: text,
  tournaments: Vec(Tournament),
  sportType: SportType,
  createdBy: Principal,
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
  registerUser: update([text, text, UserRole], Result(User, text), (name, email, role) => {
    const id = generateId();
    const user = {
      id: id,
      principal: ic.caller(),
      name: name,
      email: email,
      role: role,
    };
    usersStorage.insert(id, user);
    return Ok(user);
  }),

  // Get all users
  getUsers: query([], Vec(User), () => {
    return usersStorage.values();
  }),

  // Create League
  createLeague: update([text, SportType], Result(League, text), (name, sportType) => {
    const id = generateId();
    const league = {
      id: id,
      name: name,
      sportType: sportType,
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
  createTournament: update([text, TournamentStructure, Vec(text), SportType], Result(Tournament, text), (name, structure, teamIds, sportType) => {
    const id = generateId();
    const tournament = {
      id: id,
      name: name,
      structure: structure,
      teams: teamIds,
      sportType: sportType,
    };
    tournamentsStorage.insert(id, tournament);
    return Ok(tournament);
  }),

  // Get all tournaments
  getTournaments: query([], Vec(Tournament), () => {
    return tournamentsStorage.values();
  }),

  // Create Team
  createTeam: update([text, text, SportType, Vec(Principal)], Result(Team, text), (name, coachId, sportType, playerIds) => {
    const id = generateId();
    const team = {
      id: id,
      name: name,
      coach: ic.caller(),
      players: playerIds,
      sportType: sportType,
    };
    teamsStorage.insert(id, team);
    return Ok(team);
  }),

  // Get all teams
  getTeams: query([], Vec(Team), () => {
    return teamsStorage.values();
  }),

  // Schedule Match
  scheduleMatch: update([text, text, text], Result(Match, text), (homeTeamId, awayTeamId, scheduledDate) => {
    const homeTeamOpt = teamsStorage.get(homeTeamId);
    const awayTeamOpt = teamsStorage.get(awayTeamId);
    
    if ("None" in homeTeamOpt || "None" in awayTeamOpt) {
      return Err("One of the teams was not found.");
    }
    
    const id = generateId();
    const match = {
      id: id,
      homeTeam: homeTeamOpt.Some,
      awayTeam: awayTeamOpt.Some,
      sportType: homeTeamOpt.Some.sportType,
      scheduledDate: scheduledDate,
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
  submitMatchResult: update([text, text], Result(Match, text), (matchId, result) => {
    const matchOpt = matchesStorage.get(matchId);
    
    if ("None" in matchOpt) {
      return Err("Match not found.");
    }
    
    const match = matchOpt.Some;
    const updatedMatch = {
      ...match,
      result: Some(result),
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
          teamResults.set(match.homeTeam.id, (teamResults.get(match.homeTeam.id) || 0) + 3);
        } else if (result === match.awayTeam.id) {
          teamResults.set(match.awayTeam.id, (teamResults.get(match.awayTeam.id) || 0) + 3);
        }
      }
    });

    return teams.sort((a, b) => (teamResults.get(b.id) || 0) - (teamResults.get(a.id) || 0));
  }),
});
