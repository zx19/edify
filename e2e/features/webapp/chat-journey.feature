@webapp @core
Feature: Chat Web App journey

  @unauthenticated
  Scenario: A visitor chats with a shared chat app and starts a new conversation
    Given a chat app with an opening statement is shared via the stub model
    When the visitor opens the chat Web App
    Then the chat welcome screen shows the opening statement
    When the visitor sends "Hello from e2e" in the chat composer
    Then the stub echo answer to "Hello from e2e" is rendered in the chat
    And the conversation "Hello from e2e" appears in the conversation history
    When the visitor starts a new conversation
    Then the chat welcome screen shows the opening statement
