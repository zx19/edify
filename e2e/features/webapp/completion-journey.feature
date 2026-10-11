@webapp @core
Feature: Completion Web App journey

  @unauthenticated
  Scenario: A visitor runs a shared text-generation app once and sees the streamed result
    Given a completion app with a query prompt variable is shared via the stub model
    When the visitor opens the completion Web App
    Then the completion run form shows the "Query" field
    When the visitor fills the completion "Query" field with "autumn rain"
    And the visitor runs the completion once
    Then the stub echo answer to "Write a haiku about autumn rain." is rendered in the completion result
