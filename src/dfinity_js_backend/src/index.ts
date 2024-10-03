import { request } from "@dfinity/agent/lib/cjs/canisterStatus";
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
  Null,
  Duration,
  nat64,
  bool,
  Result,
  Canister,
} from "azle";
import {
  Ledger,
  binaryAddressFromPrincipal,
  hexAddressFromPrincipal,
} from "azle/canisters/ledger";
//@ts-ignore
import { hashCode } from "hashcode";
// Importing UUID v4 for generating unique identifiers
// @ts-ignore
import { v4 as uuidv4 } from "uuid";

// User Role Types Enum
const UserRole = Variant({
  StudentAthlete: Null,
  Coach: Null,
  Administrator: Null,
  LeagueOfficial: Null,
});

// Structure representing a User
const User = Record({
  id: text,
  owner: Principal,
  name: text,
  email: text,
  address: text,
  role: UserRole,
});

// Sport Structure
const SportType = Variant({
  Football: Null,
  Basketball: Null,
  Volleyball: Null,
});

// Struct representing a Team
const Team = Record({
  id: text,
  name: text,
  coach: Principal,
  sportType: SportType,
  members: Vec(text),
});

// Struct representing a Match
const Match = Record({
  id: text,
  homeTeam: Team,
  awayTeam: Team,
  sportType: SportType,
  scheduledDate: text,
  result: Opt(text),
});

// Referee Struct
const Referee = Record({
  id: text,
  name: text,
  email: text,
  matchesOfficiated: Vec(text),
  performanceRating: nat64, // Rating from 0-10
  totalRatings: nat64, // To calculate average rating
});

// Enum representing the structure of a Tournament
const TournamentStructure = Variant({
  RoundRobin: Null,
  Knockout: Null,
});

// Struct representing a Tournament
const Tournament = Record({
  id: text,
  name: text,
  structure: TournamentStructure,
  teams: Vec(text),
  sportType: SportType,
});

// Struct representing a League
const League = Record({
  id: text,
  name: text,
  tournaments: Vec(Tournament),
  sportType: SportType,
  createdBy: Principal,
});

// Payload for registering users
const UserPayload = Record({
  name: text,
  email: text,
  address: text,
  role: UserRole,
});

// Payload for updating users
const UpdateUserPayload = Record({
  id: text,
  name: text,
  email: text,
  role: UserRole,
});

// Team Payload
const TeamPayload = Record({
  name: text,
  coachId: text,
  sportType: SportType,
});

// Payload for adding a member to a team
const AddMemberPayload = Record({
  teamId: text,
  memberId: text,
});

// Match Payload
const MatchPayload = Record({
  homeTeamId: text,
  awayTeamId: text,
  scheduledDate: text,
});

// Match Result Payload
const MatchResultPayload = Record({
  matchId: text,
  result: text,
});

// Tournament Payload
const TournamentPayload = Record({
  name: text,
  structure: TournamentStructure,
  teamIds: Vec(text),
  sportType: SportType,
});

// League Payload
const LeaguePayload = Record({
  name: text,
  sportType: SportType,
});

// Variant representing different error types
const ErrorType = Variant({
  NotFound: text,
  InvalidPayload: text,
  PaymentFailed: text,
  PaymentCompleted: text,
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
    // Validate the payload to ensure it is a valid object
    if (typeof payload !== "object" || Object.keys(payload).length === 0) {
      return Err({ NotFound: "Invalid Payload Provided!!" });
    }

    const id = generateId();
    const user = {
      id: id,
      owner: ic.caller(),
      ...payload,
    };

    // Insert the user into the User Storage
    usersStorage.insert(id, user);
    return Ok(user);
  }),

  // Fetch a user by ID
  getUser: query([text], Result(User, ErrorType), (id) => {
    const userOpt = usersStorage.get(id);
    if ("None" in userOpt) {
      return Err({ NotFound: `User with id ${id} not found.` });
    }
    return Ok(userOpt.Some);
  }),

  // Fetch all users with error handling
  getUsers: query([], Result(Vec(User), ErrorType), () => {
    const users = usersStorage.values();

    if (users.length === 0) {
      return Err({ NotFound: "No users found." });
    }

    return Ok(users);
  }),

  // Fetch user by owner
  getUserByOwner: query([], Result(User, ErrorType), () => {
    const principal = ic.caller();

    const users = usersStorage.values().filter((user) => {
      return user.owner.toText() === principal.toText();
    });

    if (users.length === 0) {
      return Err({ NotFound: `User with owner ${principal} not found.` });
    }

    return Ok(users[0]);
  }),

  // Update user info
  updateUser: update(
    [UpdateUserPayload],
    Result(User, ErrorType),
    (payload) => {
      const userOpt = usersStorage.get(payload.id);
      if ("None" in userOpt) {
        return Err({ NotFound: `User with id ${payload.id} not found.` });
      }
      const user = {
        ...userOpt.Some,
        ...payload,
      };
      usersStorage.insert(payload.id, user);
      return Ok(user);
    }
  ),

  // Create League
  createLeague: update(
    [LeaguePayload],
    Result(League, ErrorType),
    (payload) => {
      // Validate the payload to ensure it is a valid object
      if (typeof payload !== "object" || Object.keys(payload).length === 0) {
        return Err({ NotFound: "Invalid Payload Provided!!" });
      }

      const id = generateId();
      const league = {
        id: id,
        ...payload,
        tournaments: [],
        createdBy: ic.caller(),
      };
      leaguesStorage.insert(id, league);
      return Ok(league);
    }
  ),

  // Fetch a league by ID
  getLeague: query([text], Result(League, ErrorType), (id) => {
    const leagueOpt = leaguesStorage.get(id);
    if ("None" in leagueOpt) {
      return Err({ NotFound: `League with id ${id} not found.` });
    }
    return Ok(leagueOpt.Some);
  }),

  // Fetch all leagues with error handling
  getLeagues: query([], Result(Vec(League), ErrorType), () => {
    const leagues = leaguesStorage.values();

    if (leagues.length === 0) {
      return Err({ NotFound: "No leagues found." });
    }

    return Ok(leagues);
  }),

  // Create Tournament
  createTournament: update(
    [TournamentPayload],
    Result(Tournament, ErrorType),
    (payload) => {
      // Validate the payload to ensure it is a valid object
      if (typeof payload !== "object" || Object.keys(payload).length === 0) {
        return Err({ InvalidPayload: "Invalid Payload Provided!!" });
      }

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
    }
  ),

  // Get all tournaments with error handling
  getTournaments: query([], Result(Vec(Tournament), ErrorType), () => {
    const tournaments = tournamentsStorage.values();

    if (tournaments.length === 0) {
      return Err({ NotFound: "No tournaments found." });
    }

    return Ok(tournaments);
  }),

  // Create Team
  createTeam: update([TeamPayload], Result(Team, ErrorType), (payload) => {
    // Validate the payload to ensure it is a valid object
    if (typeof payload !== "object" || Object.keys(payload).length === 0) {
      return Err({ InvalidPayload: "Invalid Payload Provided!!" });
    }

    const id = generateId();
    const team = {
      id: id,
      name: payload.name,
      coach: ic.caller(),
      sportType: payload.sportType,
      members: [],
    };
    teamsStorage.insert(id, team);
    return Ok(team);
  }),

  // Function to add a member to a team
  caddMemberToTeam: update(
    [AddMemberPayload],
    Result(Team, ErrorType),
    (payload) => {
      // Fetch the team by ID
      const teamOpt = teamsStorage.get(payload.teamId);

      // Check if the team exists
      if ("None" in teamOpt) {
        return Err({ NotFound: `Team with id ${payload.teamId} not found.` });
      }

      // Fetch the user by ID (to ensure the member exists)
      const userOpt = usersStorage.get(payload.memberId);
      if ("None" in userOpt) {
        return Err({ NotFound: `User with id ${payload.memberId} not found.` });
      }

      // Extract the team and check if the member is already part of the team
      const team = teamOpt.Some;
      if (team.members.includes(payload.memberId)) {
        return Err({ InvalidPayload: "User is already a member of the team." });
      }

      // Add the member to the team's members list
      const updatedTeam = {
        ...team,
        members: [...team.members, payload.memberId],
      };

      // Save the updated team back to storage
      teamsStorage.insert(payload.teamId, updatedTeam);

      return Ok(updatedTeam);
    }
  ),

  // Get a team by ID
  getTeam: query([text], Result(Team, ErrorType), (id) => {
    const teamOpt = teamsStorage.get(id);
    if ("None" in teamOpt) {
      return Err({ NotFound: `Team with id ${id} not found.` });
    }
    return Ok(teamOpt.Some);
  }),

  // Get all teams with error handling
  getTeams: query([], Result(Vec(Team), ErrorType), () => {
    const teams = teamsStorage.values();

    if (teams.length === 0) {
      return Err({ NotFound: "No teams found." });
    }

    return Ok(teams);
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

  // Get all matches with error handling
  getMatches: query([], Result(Vec(Match), ErrorType), () => {
    const matches = matchesStorage.values();

    if (matches.length === 0) {
      return Err({ NotFound: "No matches found." });
    }

    return Ok(matches);
  }),

  // Submit Match Result
  submitMatchResult: update(
    [MatchResultPayload],
    Result(Match, ErrorType),
    (payload) => {
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
    }
  ),

  // Leaderboards - Aggregate points for teams based on match results
  getLeaderboards: query([SportType], Vec(Team), (sportType) => {
    const teams = teamsStorage
      .values()
      .filter((team) => team.sportType === sportType);
    const teamResults = new Map();

    matchesStorage.values().forEach((match) => {
      if ("Some" in match.result) {
        const result = match.result.Some;

        if (result === match.homeTeam.id) {
          teamResults.set(
            match.homeTeam.id,
            (teamResults.get(match.homeTeam.id) || 0) + 3
          ); // Home team wins
        } else if (result === match.awayTeam.id) {
          teamResults.set(
            match.awayTeam.id,
            (teamResults.get(match.awayTeam.id) || 0) + 3
          ); // Away team wins
        }
      }
    });

    // Sort teams by their points in descending order
    return teams.sort(
      (a, b) => (teamResults.get(b.id) || 0) - (teamResults.get(a.id) || 0)
    );
  }),
});
