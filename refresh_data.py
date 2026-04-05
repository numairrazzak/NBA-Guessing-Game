#!/usr/bin/env python3
"""
Refresh NBA Player Stats Data
Scrapes current season stats from Basketball Reference and cleans the data.
Run this script to update the player data for the game.
"""

import pandas as pd
import sys
from datetime import datetime

# Configuration
URL = "https://www.basketball-reference.com/leagues/NBA_2026_totals.html"
OUTPUT_FILE = "nba_players_2025-26_stats.csv"

def scrape_data():
    """Fetch player stats from Basketball Reference."""
    print(f"Fetching data from Basketball Reference...")
    print(f"URL: {URL}")

    try:
        tables = pd.read_html(URL)
        df = tables[0]
        print(f"  Found {len(df)} rows")
        return df
    except Exception as e:
        print(f"Error fetching data: {e}")
        sys.exit(1)

def clean_data(df):
    """Clean and process the scraped data."""
    print("\nCleaning data...")

    # 1. Remove repeated header rows
    if 'Rk' in df.columns:
        before = len(df)
        df = df[df['Rk'] != 'Rk']
        print(f"  Removed {before - len(df)} header rows")

    # 2. Remove Awards column if present (usually empty)
    if 'Awards' in df.columns:
        df = df.drop(columns=['Awards'])
        print("  Removed Awards column")

    # 3. Convert numeric columns
    numeric_cols = ['G', 'GS', 'MP', 'FG', 'FGA', '3P', '3PA', '2P', '2PA',
                    'FT', 'FTA', 'ORB', 'DRB', 'TRB', 'AST', 'STL', 'BLK',
                    'TOV', 'PF', 'PTS', 'Age', 'Trp-Dbl']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # Percentage columns
    pct_cols = ['FG%', '3P%', '2P%', 'eFG%', 'FT%']
    for col in pct_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    return df

def combine_traded_players(df):
    """Combine stats for traded players into single entries."""
    print("\nProcessing traded players...")

    # Identify multi-team indicators
    multi_team_codes = ['2TM', '3TM', '4TM']

    # Find players with TOT (total) rows
    traded_players = df[df['Team'].isin(multi_team_codes)]['Player'].unique()
    print(f"  Found {len(traded_players)} traded players")

    if len(traded_players) == 0:
        return df

    # For each traded player, combine their team entries
    rows_to_drop = []
    rows_to_update = []

    for player in traded_players:
        player_rows = df[df['Player'] == player]

        # Get the TOT row (has combined stats)
        tot_row_mask = player_rows['Team'].isin(multi_team_codes)
        tot_rows = player_rows[tot_row_mask]

        if len(tot_rows) == 0:
            continue

        # Get individual team rows
        team_rows = player_rows[~tot_row_mask]
        teams = team_rows['Team'].tolist()

        if len(teams) > 0:
            # Create combined team string (e.g., "WAS/ATL")
            combined_teams = '/'.join(teams)

            # Get the index of the TOT row to update
            tot_idx = tot_rows.index[0]

            # Mark individual team rows for removal
            rows_to_drop.extend(team_rows.index.tolist())

            # Update the TOT row with combined team name
            rows_to_update.append((tot_idx, combined_teams))

    # Apply updates
    for idx, team in rows_to_update:
        df.at[idx, 'Team'] = team

    # Remove individual team rows
    df = df.drop(rows_to_drop)
    print(f"  Combined into {len(rows_to_update)} single entries")
    print(f"  Removed {len(rows_to_drop)} duplicate team rows")

    return df

def validate_data(df):
    """Run basic validation checks."""
    print("\nValidating data...")

    unique_players = df['Player'].nunique()
    total_rows = len(df)
    unique_teams = df['Team'].nunique()

    print(f"  Total rows: {total_rows}")
    print(f"  Unique players: {unique_players}")
    print(f"  Unique teams: {unique_teams}")

    # Check for any remaining duplicates
    dupes = df[df.duplicated(subset=['Player'], keep=False)]
    if len(dupes) > 0:
        print(f"  WARNING: {len(dupes)} duplicate player entries remain")
        print("  Duplicates:", dupes['Player'].unique()[:5].tolist())
    else:
        print("  No duplicate players found")

    # Check stat ranges
    if 'G' in df.columns:
        max_games = df['G'].max()
        if max_games > 82:
            print(f"  WARNING: Max games ({max_games}) exceeds 82")

    return True

def save_data(df):
    """Save the cleaned data to CSV."""
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSaved {len(df)} players to {OUTPUT_FILE}")

def main():
    print("=" * 50)
    print("NBA PLAYER STATS DATA REFRESH")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    # Scrape
    df = scrape_data()

    # Clean
    df = clean_data(df)

    # Combine traded players
    df = combine_traded_players(df)

    # Validate
    validate_data(df)

    # Save
    save_data(df)

    print("\n" + "=" * 50)
    print("REFRESH COMPLETE")
    print("=" * 50)

if __name__ == "__main__":
    main()
