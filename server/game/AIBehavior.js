class AIBehavior {
  static decideAction(aiPlayer, gameState) {
    // Update AI behavior based on current game state
    aiPlayer.updateBehavior(gameState);

    // Execute the appropriate behavior
    switch (aiPlayer.currentBehavior) {
      case "wander":
        return aiPlayer.wanderBehavior(gameState);
      case "chase":
        return aiPlayer.chaseBehavior(gameState);
      case "flee":
        return aiPlayer.fleeBehavior(gameState);
      case "collect_powerup":
        return aiPlayer.collectPowerUpBehavior(gameState);
      default:
        return aiPlayer.wanderBehavior(gameState);
    }
  }

  static selectBehavior(aiPlayer, gameState) {
    // This method is now handled by aiPlayer.updateBehavior()
    // but kept for future expansion
    if (aiPlayer.isIt) {
      return "chase";
    }

    const itPlayer = Array.from(gameState.players.values()).find((p) => p.isIt);
    if (itPlayer && aiPlayer.distanceTo(itPlayer) < 100) {
      return "flee";
    }

    const nearbyPowerUp = aiPlayer.findNearestPowerUp(gameState.powerUps);
    if (
      nearbyPowerUp &&
      aiPlayer.distanceTo(nearbyPowerUp) < 150 &&
      aiPlayer.personalityTraits.curiosity > 0.5
    ) {
      return "collect_powerup";
    }

    return "wander";
  }

  // Keep these methods for backward compatibility and future expansion
  static wanderBehavior(aiPlayer, gameState) {
    return aiPlayer.wanderBehavior(gameState);
  }

  static chaseBehavior(aiPlayer, gameState) {
    return aiPlayer.chaseBehavior(gameState);
  }

  static fleeBehavior(aiPlayer, gameState) {
    return aiPlayer.fleeBehavior(gameState);
  }

  static collectPowerUpBehavior(aiPlayer, gameState) {
    return aiPlayer.collectPowerUpBehavior(gameState);
  }
}

module.exports = AIBehavior;
