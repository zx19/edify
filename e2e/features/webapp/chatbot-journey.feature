@webapp @core
Feature: Chatbot Web App journey

  @unauthenticated
  Scenario: A visitor completes the required chat settings and chats with a shared chatbot app
    Given a chatbot app with a required variable and an opening statement is shared via the stub model
    When the visitor opens the chatbot Web App
    Then the chatbot variables form shows the required "Visitor name" field
    When the visitor starts the chatbot chat
    Then the chatbot variables form stays open with a required-field reminder
    When the visitor fills the chatbot variable "Visitor name" with "e2e visitor"
    And the visitor starts the chatbot chat
    Then the chatbot chat starts with the opening statement
    When the visitor sends "Hello from e2e chatbot" in the chat composer
    Then the stub echo answer to "Hello from e2e chatbot" is rendered in the chat
