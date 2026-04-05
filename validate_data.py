import pandas as pd

df = pd.read_csv("nba_players_2025-26_stats.csv")

print("=" * 60)
print("NBA PLAYER STATS DATA VALIDATION REPORT")
print("=" * 60)

# 1. Missing/Null Values
print("\n1. MISSING/NULL VALUES")
print("-" * 40)
null_counts = df.isnull().sum()
null_cols = null_counts[null_counts > 0]
if len(null_cols) > 0:
    print("Columns with missing values:")
    for col, count in null_cols.items():
        pct = (count / len(df)) * 100
        print(f"   {col}: {count} missing ({pct:.1f}%)")
else:
    print("No missing values found!")

# 2. Data Types
print("\n2. DATA TYPES")
print("-" * 40)
print("Column types:")
for col in df.columns:
    print(f"   {col}: {df[col].dtype}")

# Check if percentage columns are in valid range (0-1)
print("\nPercentage columns validation (should be 0-1):")
pct_cols = ['FG%', '3P%', '2P%', 'eFG%', 'FT%']
for col in pct_cols:
    if col in df.columns:
        min_val = df[col].min()
        max_val = df[col].max()
        valid = (min_val >= 0) and (max_val <= 1)
        status = "OK" if valid else "ISSUE"
        print(f"   {col}: min={min_val}, max={max_val} [{status}]")

# 3. Duplicate Players (Traded Players)
print("\n3. DUPLICATE/TRADED PLAYERS")
print("-" * 40)

# Find players with multiple entries
player_counts = df['Player'].value_counts()
multi_entry_players = player_counts[player_counts > 1]

print(f"Players with multiple entries: {len(multi_entry_players)}")
print("\nExamples of traded players:")

# Show first 5 traded players with their team entries
for player in multi_entry_players.head(5).index:
    player_rows = df[df['Player'] == player][['Player', 'Team', 'G', 'PTS']]
    print(f"\n   {player}:")
    for _, row in player_rows.iterrows():
        print(f"      Team: {row['Team']}, Games: {int(row['G'])}, Points: {int(row['PTS'])}")

# Check for "TOT" or multi-team indicators
print("\nTeam values that indicate multiple teams:")
unique_teams = df['Team'].unique()
multi_team_indicators = [t for t in unique_teams if 'TM' in str(t).upper() or 'TOT' in str(t).upper()]
print(f"   Found: {multi_team_indicators if multi_team_indicators else 'None'}")

# 4. Sanity Check Stats
print("\n4. SANITY CHECK - STAT RANGES")
print("-" * 40)
checks = {
    'Games (G)': ('G', 0, 82),
    'Points (PTS)': ('PTS', 0, 3500),  # ~42 ppg max over 82 games
    'Age': ('Age', 18, 45),
    'Minutes (MP)': ('MP', 0, 3500),
}

for check_name, (col, min_exp, max_exp) in checks.items():
    if col in df.columns:
        actual_min = df[col].min()
        actual_max = df[col].max()
        status = "OK" if (actual_min >= min_exp and actual_max <= max_exp) else "CHECK"
        print(f"   {check_name}: {actual_min} to {actual_max} [{status}]")

# 5. Spot Check Known Players
print("\n5. SPOT CHECK - TOP PLAYERS")
print("-" * 40)

# Look for some known stars
stars = ['Shai Gilgeous-Alexander', 'LeBron James', 'Stephen Curry', 'Giannis Antetokounmpo', 'Luka Dončić']

for star in stars:
    # Try exact match first, then partial match
    player_data = df[df['Player'].str.contains(star.split()[0], case=False, na=False)]
    if len(player_data) > 0:
        # Get the TOT row if exists, otherwise first row
        if 'TOT' in player_data['Team'].values:
            row = player_data[player_data['Team'] == 'TOT'].iloc[0]
        else:
            row = player_data.iloc[0]
        ppg = row['PTS'] / row['G'] if row['G'] > 0 else 0
        print(f"   {row['Player']} ({row['Team']}): {row['PTS']:.0f} pts in {row['G']:.0f} games ({ppg:.1f} PPG)")
    else:
        print(f"   {star}: NOT FOUND")

# 6. Summary Stats
print("\n6. OVERALL SUMMARY")
print("-" * 40)
print(f"   Total rows: {len(df)}")
print(f"   Unique players: {df['Player'].nunique()}")
print(f"   Unique teams: {df['Team'].nunique()}")
print(f"   Teams: {sorted(df['Team'].unique())}")

print("\n" + "=" * 60)
print("VALIDATION COMPLETE")
print("=" * 60)
